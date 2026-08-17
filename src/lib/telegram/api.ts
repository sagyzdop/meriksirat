/**
 * Telegram API Helper using native fetch
 *
 * This module provides a simple wrapper around Telegram Bot API using native fetch()
 * instead of Telegraf's HTTP client which doesn't work in Cloudflare Workers.
 */

/**
 * Call Telegram Bot API method
 */
async function callAPI(
  token: string,
  method: string,
  data: Record<string, unknown> = {}
) {
  const url = `https://api.telegram.org/bot${token}/${method}`
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })

  const result = (await response.json()) as {
    ok: boolean
    description?: string
    result: unknown
  }

  if (!result.ok) {
    throw new Error(
      `Telegram API error: ${result.description || 'Unknown error'}`
    )
  }

  return result.result
}

type SendMessageExtra = {
  parse_mode?: string
  disable_web_page_preview?: boolean
  reply_markup?: Record<string, unknown>
  caption?: string
}

/**
 * Telegram API client compatible with Telegraf's Telegram class
 */
export class TelegramAPI {
  constructor(private token: string) {}

  async sendMessage(
    chatId: number | string,
    text: string,
    extra?: SendMessageExtra
  ) {
    return await callAPI(this.token, 'sendMessage', {
      chat_id: chatId,
      text,
      ...extra,
    })
  }

  async sendPhoto(
    chatId: number | string,
    photo: string,
    extra?: SendMessageExtra
  ) {
    return await callAPI(this.token, 'sendPhoto', {
      chat_id: chatId,
      photo,
      ...extra,
    })
  }

  async answerCallbackQuery(
    callbackQueryId: string,
    text?: string,
    extra?: Record<string, unknown>
  ) {
    return await callAPI(this.token, 'answerCallbackQuery', {
      callback_query_id: callbackQueryId,
      text,
      ...extra,
    })
  }

  async getFile(fileId: string) {
    return await callAPI(this.token, 'getFile', {
      file_id: fileId,
    })
  }

  async editMessageText(
    chatId: number | string,
    messageId: number,
    text: string,
    extra?: SendMessageExtra
  ) {
    return await callAPI(this.token, 'editMessageText', {
      chat_id: chatId,
      message_id: messageId,
      text,
      ...extra,
    })
  }

  async editMessageReplyMarkup(
    chatId: number | string,
    messageId: number,
    replyMarkup?: Record<string, unknown>
  ) {
    return await callAPI(this.token, 'editMessageReplyMarkup', {
      chat_id: chatId,
      message_id: messageId,
      reply_markup: replyMarkup,
    })
  }

  async deleteMessage(chatId: number | string, messageId: number) {
    return await callAPI(this.token, 'deleteMessage', {
      chat_id: chatId,
      message_id: messageId,
    })
  }

  async setMyCommands(
    commands: Array<{ command: string; description: string }>
  ) {
    return await callAPI(this.token, 'setMyCommands', {
      commands,
    })
  }

  async setChatMenuButton(menuButton: Record<string, unknown>) {
    return await callAPI(this.token, 'setChatMenuButton', {
      menu_button: menuButton,
    })
  }
}
