import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getFounderOverview } from "@/utils/founder.functions";

export const FOUNDER_TABS = ["overview", "logins", "accounts", "messages", "campaign"] as const;
export type FounderTab = (typeof FOUNDER_TABS)[number];

export const founderOverviewQuery = queryOptions({
  queryKey: ["founder", "overview"],
  queryFn: () => getFounderOverview(),
  refetchInterval: 60_000,
});

/** Founder-only reads; the database only returns these rows to the admin account. */
export const loginHistoryQuery = queryOptions({
  queryKey: ["founder", "logins"],
  queryFn: async () => {
    const { data, error } = await supabase
      .from("login_events")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(1000);
    if (error) throw error;
    return data;
  },
  refetchInterval: 30_000,
});

export const supportMessagesQuery = queryOptions({
  queryKey: ["founder", "messages"],
  queryFn: async () => {
    const { data, error } = await supabase
      .from("support_tickets")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) throw error;
    return data;
  },
  refetchInterval: 30_000,
});
