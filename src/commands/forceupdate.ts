import { Command } from "@sapphire/framework"
import { ketchupbot } from "../index"

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

export class SlashCommand extends Command {
    public constructor(context: Command.Context, options: Command.Options) {
        super(context, {
            ...options,
            name: "manualupdate",
            description: "Forcefully update the ships (Only for testing purposes)",
            runIn: ["GUILD_TEXT"],
        })
    }

    public override registerApplicationCommands(registry: Command.Registry) {
        registry.registerChatInputCommand((builder) =>
            builder
                .setName(this.name)
                .setDescription(this.description)
                .addStringOption((option) =>
                    option
                        .setName("module")
                        .setDescription("Update ships or turrets")
                        .setChoices(
                            { name: "Ships", value: "ships" },
                            { name: "Turrets", value: "turrets" }
                        )
                        .setRequired(true)
                )
                .addStringOption((option) =>
                    option
                        .setName("ship")
                        .setDescription("Only update this ship")
                        .setRequired(false)
                )
        )
    }

    public override async chatInputRun(interaction: Command.ChatInputCommandInteraction) {
        const module = interaction.options.getString("module", true)
        const ship = interaction.options.getString("ship", false)

        await interaction.reply({ ephemeral: true, content: "[!] Please do not use this command unless you know what you're doing. This command is only for testing purposes. If you want to update the ships, please wait for the hourly pass.\nUpdating will commence in 10 seconds."})
        await sleep(10000)

        const loadingpattern = [
            "⠟",
            "⠯",
            "⠷",
            "⠾",
            "⠽",
            "⠻"
        ].reverse()

        let stopped = false
        
        await interaction.editReply(`[${loadingpattern[0]}] Updating ships`)

        ketchupbot.updateGalaxypediaShips(ship || undefined).then(async (result) => {
            stopped = true
    
            console.log(result)
    
            let message

            if (result.updatedShips.length === 0 ) {
                message = "All ships are up-to-date!"
            } else {
                message = `Sucessfully updated ships!\nShips updated: ${result.updatedShips.map((e: string) => `\n- ${e}`).join("")}\nShips skipped (Up-to-date): ${result.skippedShips.map((e: string) => `\n- ${e}`).join("")}`
            }

            await interaction.editReply(message.length > 2000 ? message.substring(0,1997) + "..." : message)
        }).catch(async (err) => {
            stopped = true
            await interaction.editReply(`Error updating ships:\n\`\`\`${err}\`\`\``)
            console.error(err)
        })

        while (!stopped) {
            try {
                await interaction.editReply(`[${loadingpattern[0]}] Updating ships`)
                loadingpattern.push(loadingpattern.shift()!)
                await sleep(500)
            } catch(err) {
                stopped = true
                console.error(err)
            }
        }
    }
}