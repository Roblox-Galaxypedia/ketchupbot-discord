import dotenv from "dotenv"
dotenv.config()

import { SapphireClient, Events } from "@sapphire/framework"
import { GatewayIntentBits } from "discord.js"
import * as ketchuplib from "./ketchupbot"
import fetch from "node-fetch"
import * as nodefetch from "node-fetch"
//import * as cron from "node-cron"
import * as Discord from "discord.js"

//const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

export const bot = new SapphireClient({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.GuildMessageReactions, GatewayIntentBits.GuildMembers, GatewayIntentBits.MessageContent, GatewayIntentBits.GuildWebhooks] })
export const ketchupbot = new ketchuplib.ShipUpdater()

async function logChange(name: string, revision: { revid: string | number } | null) {
    await fetch(process.env.WEBHOOK!, {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            content: `Updated **${name}**! ${(revision ? `([diff](<https://robloxgalaxy.wiki/index.php?title=${encodeURIComponent(name)}&diff=prev&oldid=${encodeURIComponent(revision.revid)}>))` : "")}`
        })
    })
}

async function logDiscord(content: unknown) {
    await fetch(process.env.WEBHOOK!, {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            content: typeof content === "string" ? content : JSON.stringify(content)
        })
    })
}

bot.once(Events.ClientReady, async () => {
    console.log(`Logged in as ${bot.user!.tag}!`)
    bot.user?.setActivity("the upstream API", { type: Discord.ActivityType.Listening })
    const mwbot = await ketchuplib.initBot()

    const updater = await ketchupbot.main(mwbot, logChange, logDiscord, true)
})

// GalaxyGPT Module
bot.on(Events.MessageCreate, async (message) => {
    if (message.author.bot) return

    const args = message.content.trim().split(/ +/g)

    // only listen to messages that mention the bot at the start of the message
    if (!message.content.trim().startsWith(`<@!${bot.user!.id}>`) && !message.content.trim().startsWith(`<@${bot.user!.id}>`)) return
    // only run in the testing channel
    if (message.channel.id !== "1100079016372867122") {
        try {
            message.delete()
        } catch (e) {
            console.error(e)
        }
        return
    }

    // slice off the mention and get the content of the message
    const prompt = args.slice(1).join(" ").toString().trim()
    console.log(prompt + " - " + message.author.username)

    // check if the prompt is too long
    if (prompt.length > 750) {
        message.reply("Your question is too long! Please keep it under 500 characters.")
        return
    }

    // check if the prompt is empty
    if (prompt === "") {
        message.reply("Hello! I'm KetchupBot. The official Galaxypedia Assistant & Automatic Updater!\n\nUpdates ships every hour at XX:00\nUpdates turrets page every hour at XX:30\nMore information can be found here: <https://robloxgalaxy.wiki/wiki/User:Ketchupbot101>\n\nReport any unintended behaviour to Galaxypedia Head Staff immediately\n<https://discord.robloxgalaxy.wiki>")
        return
    }

    // quick console log for monitoring
    console.log("prompt: " + prompt)

    const loadingpattern = [
        ".",
        "..",
        "...",
    ]

    // send the loading animation
    const balling = await message.reply(`Thinking${loadingpattern[2]}`)

    try {
        const api = fetch(process.env.GPTAPIURL || "http://localhost:3636/api/v1/ask", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                prompt: prompt,
                username: message.author.username
            })
        })

        api.then(async (res) => {
            if (!res.ok) {
                message.reply("Something went wrong. Please try again later.\nDebug info:\n```Got status code from API: " + res.status + "```\nCheck the console for more info.")
                console.error(api)
                return
            }

            interface Response {
                answer: string,
                context: string | null,
                tokens: {
                    completion_tokens: number
                    prompt_tokens: number
                    total_tokens: number
                } | null,
                embeddings_usage: {
                    prompt_tokens: number,
                    total_tokens: number
                } | null,
                stop_reason: string | null,
                dataset: string | null,
                version: string
            }

            const response: Response = await res.json()

            if (!response) {
                message.reply("Something went wrong. Please try again later.\nDebug info:\n```Got status code from API: " + res.status + "```")
                return
            }

            console.log(response.answer)

            let bingus: Discord.Message
            if (response.tokens && response.embeddings_usage) {
                const totalchatcost = parseFloat((((response.tokens.prompt_tokens / 1000) * 0.0015) + ((response.tokens.completion_tokens / 1000) * 0.002)).toFixed(8))
                const totalembeddingscost = parseFloat(((response.embeddings_usage.total_tokens / 1000) * 0.0001).toFixed(8))
                const totalcost = parseFloat((totalchatcost + totalembeddingscost).toFixed(8))
                console.log("Context: ", response.context ?? "Unknown")
                const contexttxt = Buffer.from(response.context ?? "Unknown", "utf8")
                bingus = await balling.edit({ content: `${response.answer}\n\n### ChatGPT\nCompletion Tokens: ${response.tokens.completion_tokens ?? "Unknown"}\nPrompt Tokens: ${response.tokens.prompt_tokens ?? "Unknown"}\nTotal Tokens: ${response.tokens.total_tokens ?? "Unknown"} (USD $${totalchatcost})\n### Embeddings\nPrompt Tokens: ${response.embeddings_usage.prompt_tokens ?? "Unknown"}\nTotal Tokens: ${response.embeddings_usage.total_tokens ?? "Unknown"} (USD $${totalembeddingscost})\n### Debugging\nTotal Tokens Used: ${response.tokens.total_tokens + response.embeddings_usage.total_tokens ?? "Unknown"} (USD $${totalcost})\nStop Reason: ${response.stop_reason ?? "Unknown"}\nGalaxyGPT v${response.version} ${response.dataset ? response.dataset.toString() : ""}`, files: [{ name: "context.txt", attachment: contexttxt }] })
            } else {
                bingus = await balling.edit({ content: `${response.answer}\nGalaxyGPT v${response.version} ${response.dataset ? response.dataset.toString() : ""}` })
            }

            /*             if ((bingus.channel as Discord.TextChannel).permissionsFor(bot.user!)?.has(Discord.PermissionFlagsBits.AddReactions) === false) return
                        await bingus.react("926726958052671538")
                        await bingus.react("926726956970569809")
                
                        bingus.awaitReactions({ filter: (reaction: Discord.MessageReaction, user: Discord.User) => { return (user.id === message.author.id && (reaction.emoji.id === "926726958052671538" || reaction.emoji.id === "926726956970569809")) }, max: 1, time: 900000 }).then(async (collected) => {
                            if (collected.first()?.emoji.id === "926726958052671538") {
                                // like
                                await bingus.reactions.removeAll()
                                message.channel.send(Discord.userMention(message.author.id) + " Thank you for your feedback!")
                            } else if (collected.first()?.emoji.id === "926726956970569809") {
                                // dislike
                                await bingus.reactions.removeAll()
                                message.channel.send(`${Discord.userMention(message.author.id)} Thank you for your feedback!\nCan you tell me how I can improve?\nbtw this feature isnt ready yet`)
                            }
                            console.log("Collected" + collected.first()?.emoji.id)
                        }).catch(async (err) => {
                            await bingus.reactions.removeAll()
                            console.error(err)
                        }) */
        }).catch(async (err: unknown) => {
            console.error(err)

            if (err instanceof nodefetch.FetchError) {
                switch (err.code) {
                    case "ECONNREFUSED":
                        balling.edit("Something went wrong. Please try again later.\nDebug Info:\n```Connection Refused```")
                        break
                    case "ECONNRESET":
                        balling.edit("Something went wrong. Please try again later.\nDebug Info:\n```Connection Reset```")
                        break
                    default:
                        balling.edit("Something went wrong. Please try again later.\nDebug Info:\n```" + err.message + "```")
                }
            }
        })

        const animation = setInterval(async () => {
            try {
                await balling.edit(`Thinking${loadingpattern[0]}`)
                loadingpattern.push(loadingpattern.shift()!)
            } catch (err: any) {
                console.error(err)
                clearInterval(animation)
            }
        }, 1000)

        api.finally(() => {
            clearInterval(animation)
        })

    } catch (err: any) {
        balling.edit("Something went wrong. Please try again later.\nDebug Info:\n```" + err.message + "```")
        console.error(err)
    }
})


bot.login(process.env.TOKEN!)