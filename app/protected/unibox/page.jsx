import { createClient } from "@/utils/supabase/server";
import UniboxClient from "./unibox-client";

export default async function ProtectedPage() {
  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return <div>No user session found!</div>;
  }

  // Query the backends table for backends owned by the user.
  const { data: backends, error: backendError } = await supabase
    .from("backends")
    .select("*")
    .eq("user_id", user.id);

  if (backendError) {
    return <div>Error loading backends: {backendError.message}</div>;
  }

  if (!backends || backends.length === 0) {
    return <div>No backends found for this user.</div>;
  }

  // Extract backend IDs.
  const backendIds = backends.map((backend) => backend.id);

  // Query the inboxes table where the backend_id is in the list of backend IDs.
  const { data: inboxes, error: inboxError } = await supabase
    .from("inboxes")
    .select("*")
    .in("backend_id", backendIds)
    .order("last_message_timestamp", { ascending: false });

  if (inboxError) {
    return <div>Error loading messages: {inboxError.message}</div>;
  }

  // Combine each inbox record with its associated backend base_url.
  const userInboxes = (inboxes || []).map((inbox) => {
    const associatedBackend = backends.find(
      (backend) => backend.id === inbox.backend_id
    );
    return {
      ...inbox,
      backend_base_url: associatedBackend ? associatedBackend.base_url : null,
    };
  });

  return (
    <section>
      <UniboxClient userInboxes={userInboxes} />
    </section>
  );
}
