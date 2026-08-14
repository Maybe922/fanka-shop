export function isAuthorizedFeishuChat(input: {
  chatId: string | undefined;
  chatType: string | undefined;
  senderOpenId: string | undefined;
  ownerChatId: string | undefined;
  ownerOpenId: string | undefined;
}): boolean {
  if (!input.chatId) return false;
  if (input.ownerChatId && input.chatId === input.ownerChatId) return true;
  return Boolean(
    input.chatType === "p2p" &&
      input.ownerOpenId &&
      input.senderOpenId === input.ownerOpenId,
  );
}
