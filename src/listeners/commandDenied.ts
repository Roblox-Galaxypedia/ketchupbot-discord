// Disabled for the time being
import { Listener, UserError, ChatInputCommandDeniedPayload } from "@sapphire/framework"

export class CommandDeniedListener extends Listener {
    public constructor(context: Listener.Context, options: Listener.Options) {
        super(context, {
            ...options,
            event: "chatInputCommandDenied",
        })
    }

    public async run(error: UserError, { interaction }: ChatInputCommandDeniedPayload) {
        if (Reflect.get(Object(error.context), "silent")) return
        return

        console.error(error.stack)
        await interaction.reply({ content: error.message, ephemeral: true })
    }
}