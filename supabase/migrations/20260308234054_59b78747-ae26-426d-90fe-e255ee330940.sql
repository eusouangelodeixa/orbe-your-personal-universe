-- Bloqueia débitos sem saldo na carteira (garantia no backend)
create or replace function public.validate_wallet_balance_before_debit_tx()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_balance numeric;
  v_wallet_name text;
begin
  if new.type <> 'debit' then
    return new;
  end if;

  select balance, name
    into v_balance, v_wallet_name
  from public.wallets
  where id = new.wallet_id
    and user_id = new.user_id;

  if not found then
    raise exception 'Carteira inválida para este usuário.';
  end if;

  if coalesce(v_balance, 0) < coalesce(new.amount, 0) then
    raise exception 'Saldo insuficiente na carteira "%". Disponível: R$ %, necessário: R$ %.',
      v_wallet_name,
      to_char(coalesce(v_balance, 0), 'FM9999999990D00'),
      to_char(coalesce(new.amount, 0), 'FM9999999990D00');
  end if;

  return new;
end;
$$;

drop trigger if exists trg_validate_wallet_balance_before_debit_tx on public.wallet_transactions;
create trigger trg_validate_wallet_balance_before_debit_tx
before insert on public.wallet_transactions
for each row
execute function public.validate_wallet_balance_before_debit_tx();

-- Bloqueia registro/atualização de gasto pago com carteira sem saldo
create or replace function public.validate_wallet_balance_before_paid_expense()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_balance numeric;
  v_wallet_name text;
  v_required numeric := 0;
begin
  if new.paid is distinct from true or new.wallet_id is null then
    return new;
  end if;

  -- Inserção de gasto já pago: precisa do valor total
  if tg_op = 'INSERT' then
    v_required := coalesce(new.amount, 0);
  else
    -- Atualização:
    -- se já estava pago na mesma carteira, exige apenas diferença positiva
    if old.paid is true and old.wallet_id = new.wallet_id then
      v_required := greatest(coalesce(new.amount, 0) - coalesce(old.amount, 0), 0);
    else
      -- mudou de carteira ou passou de não pago -> pago
      v_required := coalesce(new.amount, 0);
    end if;
  end if;

  if v_required <= 0 then
    return new;
  end if;

  select balance, name
    into v_balance, v_wallet_name
  from public.wallets
  where id = new.wallet_id
    and user_id = new.user_id;

  if not found then
    raise exception 'Carteira inválida para este usuário.';
  end if;

  if coalesce(v_balance, 0) < v_required then
    raise exception 'Saldo insuficiente na carteira "%". Disponível: R$ %, necessário: R$ %.',
      v_wallet_name,
      to_char(coalesce(v_balance, 0), 'FM9999999990D00'),
      to_char(v_required, 'FM9999999990D00');
  end if;

  return new;
end;
$$;

drop trigger if exists trg_validate_wallet_balance_before_paid_expense on public.expenses;
create trigger trg_validate_wallet_balance_before_paid_expense
before insert or update of paid, wallet_id, amount on public.expenses
for each row
execute function public.validate_wallet_balance_before_paid_expense();