using System.ServiceModel.Syndication;
using System.Xml;

namespace ketchupbot_discord;

public static class BlogTracker
{
    private const string Url = "https://blog.smallketchup.ca/feed.xml";

    private static DateTimeOffset? _lastUpdate;

    public static bool CheckForUpdates()
    {
        using var reader = XmlReader.Create(Url);
        SyndicationFeed feed = SyndicationFeed.Load(reader);

        if (_lastUpdate == null)
        {
            _lastUpdate = feed.LastUpdatedTime;
            return false;
        }

        if (!(feed.LastUpdatedTime > _lastUpdate)) return false;

        _lastUpdate = feed.LastUpdatedTime;
        return true;
    }

    public static string GetLatestPostUrl()
    {
        using var reader = XmlReader.Create(Url);
        SyndicationFeed feed = SyndicationFeed.Load(reader);
        reader.Close();

        SyndicationItem? latestPost = feed.Items.First();
        return latestPost.Links.First().Uri.ToString();
    }
}
