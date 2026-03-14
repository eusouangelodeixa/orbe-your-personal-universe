import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export function useUserRole() {
  const { user } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    if (!user) {
      setIsAdmin(false);
      setIsLoading(false);
      return () => {
        isMounted = false;
      };
    }

    setIsLoading(true);
    setIsAdmin(false);

    const checkRole = async () => {
      try {
        const { data, error } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", user.id)
          .eq("role", "admin")
          .maybeSingle();

        if (!isMounted) return;
        setIsAdmin(!error && !!data);
      } catch {
        if (!isMounted) return;
        setIsAdmin(false);
      } finally {
        if (!isMounted) return;
        setIsLoading(false);
      }
    };

    checkRole();

    return () => {
      isMounted = false;
    };
  }, [user?.id]);

  return { isAdmin, isLoading };
}
