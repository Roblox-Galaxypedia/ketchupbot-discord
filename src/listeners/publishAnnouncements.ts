import { Listener } from "@sapphire/framework"
import { Message } from "discord.js"

export class AnnouncementListener extends Listener {
  public constructor(context: Listener.Context, options: Listener.Options) {
    super(context, {
      ...options,
      event: "messageCreate",
    })
  }

  public async run(message: Message) {
	const announcementchannels: string[] = ["913918135785111572", "956568339851931728", "982405340492599356"]

	if (!announcementchannels.some(channel => channel === message.channelId)) return

	try {
		await message.crosspost()
	} catch (error) {
		console.error(error)
	}
  }
}