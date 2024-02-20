import { Command } from "@sapphire/framework"
import { ketchupbot } from "../index"
import fetch from "node-fetch"
import * as Discord from "discord.js"

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

export class SlashCommand extends Command {
    public constructor(context: Command.Context, options: Command.Options) {
        super(context, {
            ...options,
            name: "adcs",
            description: "Manage ADCS",
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
                        .setName("operation")
                        .setDescription("What operation to perform")
                        .setChoices(
                            { name: "Start", value: "start" },
                            { name: "Stop", value: "stop" },
                            { name: "Status", value: "status" },
                            { name: "Force Create", value: "force-create"}
                        )
                        .setRequired(true)
                )
        )
    }

    public override async chatInputRun(interaction: Command.ChatInputCommandInteraction) {
        const operation = interaction.options.getString("operation", true)

        const adcs_endpoint = process.env.ADCS_ENDPOINT || "http://localhost:3636/api/ADCS"

        await interaction.deferReply()

        if (interaction.member!.permissions instanceof Discord.PermissionsBitField && !interaction.member!.permissions.has(Discord.PermissionsBitField.Flags.Administrator)) {
            await interaction.editReply("You do not have permission to perform this operation!")
            return
        }

        if (operation === "start") {
            await interaction.editReply("Starting ADCS...")
            
            const res = fetch(`${adcs_endpoint}/start`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                }
            })

            res.then(async (res) => {
                if (!res.ok) {
                    await interaction.editReply("Failed to start ADCS. Please inspect logs for more information")
                    console.log(res)
                    return
                }
                await interaction.editReply("Started ADCS!")
            })

            res.catch(async (err) => {
                await interaction.editReply("Failed to start ADCS. Please inspect logs for more information")
                console.error(err)
            })
        } else if (operation === "stop") {
            await interaction.editReply("Stopping ADCS...")

            const res = fetch(`${adcs_endpoint}/stop`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                }
            })

            res.then(async (res) => {
                if (!res.ok) {
                    await interaction.editReply("Failed to stop ADCS. Please inspect logs for more information")
                    console.log(res)
                    return
                }
                await interaction.editReply("Stopped ADCS!")
            })

            res.catch(async (err) => {
                await interaction.editReply("Failed to stop ADCS. Please inspect logs for more information")
                console.error(err)
            })
        } else if (operation === "status") {
            await interaction.editReply("Checking ADCS status...")

            const res = fetch(`${adcs_endpoint}/status`, {
                method: "GET",
                headers: {
                    "Content-Type": "application/json"
                }
            })

            res.then(async (res) => {
                if (!res.ok) {
                    await interaction.editReply("Failed to get ADCS status. Please inspect logs for more information")
                    console.log(res)
                    return
                }
                
                const status = await res.json()

                await interaction.editReply("ADCS is currently " + status.status)
            })

            res.catch(async (err) => {
                await interaction.editReply("Failed to get ADCS status. Please inspect logs for more information")
                console.error(err)
            })
        } else if (operation === "force-create") {
            await interaction.editReply("Forcefully creating a new ADCS dataset...")

            const res = fetch(`${adcs_endpoint}/force-create`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                }
            })

            res.then(async (res) => {
                if (!res.ok) {
                    await interaction.editReply("Failed to create an ADCS dataset. Please inspect logs for more information")
                    console.log(res)
                    return
                }
                await interaction.editReply("Created a new ADCS dataset!")
            })

            res.catch(async (err) => {
                await interaction.editReply("Failed to create an ADCS dataset. Please inspect logs for more information")
                console.error(err)
            })
        }
    }
}