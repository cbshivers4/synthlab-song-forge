import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { setMarketingConsent } from "@/utils/founder.functions";
import { TEST_MODE } from "@/lib/synclab/test-mode";

/** The signed-in person's own "tips and offers by email" choice (off unless they turned it on). */
export function MarketingEmailSwitch() {
  const [on, setOn] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (TEST_MODE) return;
    let active = true;
    void supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) return;
      const { data: row } = await supabase
        .from("marketing_contacts")
        .select("opted_in")
        .eq("user_id", data.user.id)
        .maybeSingle();
      if (active) setOn(row?.opted_in ?? false);
    });
    return () => {
      active = false;
    };
  }, []);

  if (on === null) return <span className="text-xs text-muted-foreground">Sign in to choose</span>;
  return (
    <Switch
      checked={on}
      disabled={busy}
      aria-label="Email me SYNCLAB tips, tutorials and offers"
      onCheckedChange={async (v) => {
        setBusy(true);
        try {
          const r = await setMarketingConsent({ data: { optedIn: v } });
          setOn(r.optedIn);
          toast.success(
            r.optedIn
              ? "You'll get SYNCLAB tips and offers by email"
              : "No more tips and offers emails",
          );
        } catch (e) {
          toast.error(e instanceof Error ? e.message : "Couldn't save your choice");
        } finally {
          setBusy(false);
        }
      }}
    />
  );
}
