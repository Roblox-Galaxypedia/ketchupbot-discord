using System.Diagnostics;
using Discord;
using Discord.Interactions;

namespace ketchupbot_discord.Modules;

public class RembgCommand : InteractionModuleBase<SocketInteractionContext>
{
    [SlashCommand("rembg", "Remove an images background")]
    public async Task RembgAsync(IAttachment attachment,
        [Summary(description: "The model to use")]
        [Choice("u2net", "u2net")]
        [Choice("isnet", "isnet-general-use")]
        [Choice("birefnet", "birefnet-general")]
        [Choice("birefnet-dis", "birefnet-dis")]
        [Choice("birefnet-hrsod", "birefnet-hrsod")]
        [Choice("birefnet-cod", "birefnet-cod")]
        string model = "u2net")
    {
        await DeferAsync();
        if (attachment.ContentType != "image/png" && attachment.ContentType != "image/jpeg")
        {
            await FollowupAsync("Invalid file type. Please provide a PNG or JPEG image.");
            return;
        }

        string path = Path.Combine(Path.GetTempPath(), attachment.Filename);
        string ouputPath = Path.Combine(Path.GetTempPath(), Guid.NewGuid() + ".png");

        try
        {
            using var client = new HttpClient();
            await using Stream response = await client.GetStreamAsync(attachment.Url);
            await using FileStream fileStream = File.Create(path);

            await response.CopyToAsync(fileStream);

            // TODO: Maybe try to use pipes instead of files
            var process = new Process
            {
                StartInfo = new ProcessStartInfo
                {
                    FileName = "rembg",
                    Arguments = $"i {path} -m {model} {ouputPath}",
                    RedirectStandardOutput = true,
                    RedirectStandardError = true,
                    UseShellExecute = false,
                    CreateNoWindow = true
                }
            };

            process.Start();

            string commandOutput = await process.StandardOutput.ReadToEndAsync();
            string commandErrorOutput = await process.StandardError.ReadToEndAsync();

            await process.WaitForExitAsync();

            Console.WriteLine(commandOutput);
            Console.WriteLine(commandErrorOutput);

            await FollowupWithFileAsync(ouputPath, text: "here's your image :3");
        }
        catch (Exception e)
        {
            Console.WriteLine(e);
            await FollowupAsync("An error occurred");
        }
        finally
        {
            File.Delete(path);
            File.Delete(ouputPath);
        }
    }
}