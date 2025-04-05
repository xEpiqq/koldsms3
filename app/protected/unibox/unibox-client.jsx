"use client";

import React, { useState, useEffect, useRef } from "react";
import { Heading } from "@/components/heading";
import { Text } from "@/components/text";
import { Fieldset, FieldGroup, Field, Label } from "@/components/fieldset";
import { Input } from "@/components/input";
import { Textarea } from "@/components/textarea";
import { Button } from "@/components/button";

/**
 * Helper function to format a phone number.
 * Assumes the number is a string of digits (e.g. "13853430571")
 * and formats it as: "+1 (385) 343-0571".
 */
function formatPhoneNumber(phone) {
  const cleaned = phone.replace(/\D/g, "");
  if (cleaned.length === 11) {
    const country = cleaned[0];
    const area = cleaned.slice(1, 4);
    const prefix = cleaned.slice(4, 7);
    const line = cleaned.slice(7);
    return `+${country} (${area}) ${prefix}-${line}`;
  }
  return phone;
}

export default function UniboxClient({ userInboxes }) {
  const [selectedInbox, setSelectedInbox] = useState(null);
  const [conversation, setConversation] = useState([]);
  const [status, setStatus] = useState("");

  const [newSelectedInbox, setNewSelectedInbox] = useState(null);
  const [newPhoneNumber, setNewPhoneNumber] = useState("");
  const [newMessage, setNewMessage] = useState("");
  const [showNewForm, setShowNewForm] = useState(false);
  const [loadingConv, setLoadingConv] = useState(false);

  // New state for conversation input (for when an inbox is open)
  const [conversationInput, setConversationInput] = useState("");

  // Reference for the conversation container.
  const conversationContainerRef = useRef(null);

  // Auto-scroll to the bottom when conversation updates.
  useEffect(() => {
    if (conversationContainerRef.current) {
      conversationContainerRef.current.scrollTop =
        conversationContainerRef.current.scrollHeight;
    }
  }, [conversation]);

  /**
   * When an inbox row is clicked, we:
   *  1. Retrieve its base_url by looking up its backend using backend_id.
   *  2. Use that base_url to send a request to the appropriate backend.
   */
  async function loadConversation(inbox) {
    if (!inbox) {
      setConversation([]);
      return;
    }
    setLoadingConv(true);
    try {
      // Build the itemId as before.
      const itemId = "t.%2B" + inbox.phone_number;

      // Retrieve the base_url from the associated backend.
      const backendUrl = inbox.backend_base_url;
      if (!backendUrl) {
        throw new Error("No backend URL found for this message.");
      }

      // Route the conversation request to the correct backend using its base_url.
      const res = await fetch(
        `${backendUrl}/conversation?itemId=${encodeURIComponent(
          itemId
        )}&account_index=${inbox.account_index}&user_id=${inbox.user_id}`
      );

      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setConversation(data);
    } catch (err) {
      console.error("Conversation error:", err.message);
      setStatus(`Error loading conversation: ${err.message}`);
    } finally {
      setLoadingConv(false);
    }
  }

  function selectInbox(inbox) {
    console.log(inbox.backend_base_url);
    setSelectedInbox(inbox);
    setShowNewForm(false);
    setStatus("");
    setConversation([]);
    loadConversation(inbox);
  }

  /**
   * When sending a new message from the new message form.
   */
  async function handleSendNew() {
    if (
      !newPhoneNumber ||
      !newMessage ||
      newSelectedInbox === null ||
      !userInboxes[newSelectedInbox]
    )
      return;

    setStatus("Sending new message...");
    try {
      const selected = userInboxes[newSelectedInbox];

      // Retrieve the backend base_url from the selected inbox.
      const backendUrl = selected.backend_base_url;
      if (!backendUrl)
        throw new Error("No backend URL found for this message.");

      const res = await fetch(`${backendUrl}/send-message`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phoneNumber: newPhoneNumber,
          text: newMessage,
          account_index: selected.account_index,
          user_id: selected.user_id,
        }),
      });

      if (!res.ok) throw new Error(await res.text());
      const responseText = await res.text();
      setStatus(responseText);
      setNewPhoneNumber("");
      setNewMessage("");

      // Optional: Refresh inboxes after sending.
    } catch (err) {
      setStatus("Error: " + err.message);
    }
  }

  /**
   * When sending a message from within an active conversation.
   * This endpoint does not require a phone number since the conversation is already open.
   */
  async function handleSendConversation() {
    if (!conversationInput.trim()) return;
    setStatus("Sending message...");
    try {
      const backendUrl = selectedInbox.backend_base_url;
      const res = await fetch(`${backendUrl}/conversation-send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: conversationInput,
          account_index: selectedInbox.account_index,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      const responseText = await res.text();
      setStatus(responseText);
      setConversationInput("");
      // Refresh conversation after sending
      loadConversation(selectedInbox);
    } catch (err) {
      setStatus("Error: " + err.message);
    }
  }

  // Sort inboxes so that messages with an unread count > 0 are shown first.
  const sortedInboxes = [...userInboxes].sort(
    (a, b) => (b.unread_count || 0) - (a.unread_count || 0)
  );

  return (
    <div className="h-screen overflow-hidden flex">
      {/* LEFT: Unified Inbox List */}
      <div className="w-80 flex-shrink-0 border-r p-4">
        <div className="flex items-center justify-between mb-4">
          <Heading level={3}>Unified Inbox</Heading>
          <Button
            color="cyan"
            onClick={() => {
              setSelectedInbox(null);
              setShowNewForm(true);
              setStatus("");
            }}
          >
            Send Message
          </Button>
        </div>
        <div
          className="flex flex-col gap-3 h-[calc(100vh-100px)] overflow-y-auto pr-1"
          style={{
            scrollbarWidth: "thin",
            scrollbarColor: "#666 #2f2f2f",
          }}
        >
          {sortedInboxes.map((inbox, idx) => {
            const isActive =
              selectedInbox && selectedInbox.id === inbox.id;
            return (
              <div
                key={idx}
                className={`border rounded p-4 cursor-pointer ${
                  isActive ? "border-blue-500 bg-gray-100" : ""
                }`}
                onClick={() => selectInbox(inbox)}
              >
                <Text className="text-sm font-medium">
                  From: {formatPhoneNumber(inbox.phone_number)}
                </Text>
                <Text
                  className={`text-xs text-gray-500 ${
                    inbox.unread_count > 0 ? "font-bold" : ""
                  }`}
                >
                  {inbox.last_message || "No messages yet."}
                </Text>
                {inbox.last_message_timestamp && (
                  <Text className="text-xs text-zinc-500 mt-1 mb-0">
                    {new Date(
                      inbox.last_message_timestamp
                    ).toLocaleString()}
                  </Text>
                )}
                {inbox.unread_count > 0 && (
                  <Text className="text-xs text-red-500">
                    {inbox.unread_count} New Replies
                  </Text>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* RIGHT: Conversation Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <div
          className="flex-1 overflow-y-auto px-6 py-4"
          ref={conversationContainerRef}
        >
          {showNewForm ? (
            <>
              <Heading level={3}>Send a New Message</Heading>
              <Fieldset className="mt-4 space-y-3">
                <FieldGroup>
                  <Field>
                    <Label>Inbox</Label>
                    <select
                      className="mt-1 block w-full rounded border border-zinc-300 bg-white dark:bg-zinc-800 dark:border-zinc-700 text-sm p-2"
                      value={newSelectedInbox !== null ? newSelectedInbox : ""}
                      onChange={(e) =>
                        setNewSelectedInbox(Number(e.target.value))
                      }
                    >
                      <option value="">--Select Inbox--</option>
                      {userInboxes.map((inbox, i) => (
                        <option key={i} value={i}>
                          {formatPhoneNumber(inbox.phone_number)}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field>
                    <Label>Phone</Label>
                    <Input
                      className="mt-1 w-full"
                      value={newPhoneNumber}
                      onChange={(e) => setNewPhoneNumber(e.target.value)}
                    />
                  </Field>
                  <Field>
                    <Label>Message</Label>
                    <Textarea
                      className="mt-1 w-full"
                      rows={5}
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                    />
                  </Field>
                </FieldGroup>
              </Fieldset>
              <Button color="cyan" className="mt-3" onClick={handleSendNew}>
                Send Message
              </Button>
              {status && (
                <Text className="mt-2 text-sm text-rose-600">{status}</Text>
              )}
            </>
          ) : selectedInbox ? (
            <>
              <Heading level={3}>
                Conversation with{" "}
                {formatPhoneNumber(selectedInbox.phone_number)}
              </Heading>
              {loadingConv ? (
                <p>Loading conversation...</p>
              ) : conversation.length === 0 ? (
                <Text>No messages yet.</Text>
              ) : (
                <div className="mt-3 space-y-3">
                  {conversation.map((msg, i) => {
                    const isFromMe = msg.direction === "outgoing";
                    return (
                      <div
                        key={i}
                        className={`flex mb-2 ${
                          isFromMe ? "justify-end" : "justify-start"
                        }`}
                      >
                        <div
                          className={`flex flex-col ${
                            isFromMe ? "items-end" : "items-start"
                          }`}
                        >
                          <div
                            className={`inline-block px-3 py-2 max-w-[80%] whitespace-pre-wrap break-words rounded-lg ${
                              isFromMe
                                ? "bg-cyan-100 text-black"
                                : "bg-zinc-100 dark:bg-zinc-800 text-black dark:text-white"
                            }`}
                          >
                            {msg.text}
                          </div>
                          <div className="text-xs text-zinc-500 mt-1">
                            {msg.time}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
              {/* New input field for sending a message within an open conversation */}
              <div className="mt-4 flex gap-2">
                <Input
                  className="flex-1"
                  placeholder="Type your message..."
                  value={conversationInput}
                  onChange={(e) => setConversationInput(e.target.value)}
                />
                <Button color="cyan" onClick={handleSendConversation}>
                  Send
                </Button>
              </div>
              {status && (
                <Text className="mt-2 text-sm text-rose-600">{status}</Text>
              )}
            </>
          ) : (
            <Heading level={3}>Select a conversation.</Heading>
          )}
        </div>
      </div>
    </div>
  );
}
