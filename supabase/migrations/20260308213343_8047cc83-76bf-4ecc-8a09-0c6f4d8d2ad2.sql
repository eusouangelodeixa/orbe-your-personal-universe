
CREATE TABLE public.admin_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  value jsonb NOT NULL DEFAULT '{}'::jsonb,
  description text,
  category text NOT NULL DEFAULT 'general',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.admin_settings ENABLE ROW LEVEL SECURITY;

-- Only service role can access (via edge functions)
CREATE POLICY "No direct access to admin_settings"
ON public.admin_settings FOR ALL TO authenticated
USING (false) WITH CHECK (false);

-- Insert default settings
INSERT INTO public.admin_settings (key, value, description, category) VALUES
  ('uazapi', '{"url": "", "token": "", "enabled": true}'::jsonb, 'Configurações da API uazapi para WhatsApp', 'connections'),
  ('ai_transcription', '{"provider": "lovable", "api_key": "", "model": "", "enabled": false}'::jsonb, 'Modelo alternativo para transcrição', 'connections'),
  ('ai_text', '{"provider": "lovable", "api_key": "", "model": "", "enabled": false}'::jsonb, 'Modelo alternativo para geração de texto', 'connections'),
  ('stripe', '{"publishable_key": "", "secret_key": "", "webhook_secret": "", "enabled": false}'::jsonb, 'Configurações do Stripe para pagamentos', 'connections');
