class Entry {
  constructor(title, artist, image, duration, url) {
    this.title = title;
    this.artist = artist;
    this.image = image;
    this.duration = duration;
    this.url = url;
  }
}


class Playlist {
  constructor(name, author, image, entries, url) {
    this.name = name;
    this.author = author;
    this.image = image;
    this.entries = entries;
    this.url = url;
  }
}

class Searcher {
  static get(url, headers) {
    return new Promise(function(resolve, reject) {
      let request = new XMLHttpRequest();

      function respHandler() {
        resolve(this.response);
      }

      request.addEventListener("load", respHandler);

      request.open("GET", url);

      if (headers) {
        for (var i = 0; i < headers.length; i++) {
          request.setRequestHeader(headers[i][0], headers[i][1]);
        }
      }

      request.send();
    });
  }

  static post(url, headers) {
    return new Promise(function(resolve, reject) {
      let request = new XMLHttpRequest();

      function respHandler() {
        resolve(this.response);
      }

      request.addEventListener("load", respHandler);

      request.open("POST", url);

      if (headers) {
        for (var i = 0; i < headers.length; i++) {
          request.setRequestHeader(headers[i][0], headers[i][1]);
        }
      }

      request.send();
    });
  }

  static search(query) {}

  static getUrl(url) {}

  static featured() {}
}

class YoutubeSearcher extends Searcher {
  static rawSearch(query) {
    return super.get("https://www.googleapis.com/youtube/v3/search?part=snippet&maxResults=20&q=" + encodeURI(query) + "&topicId=%2Fm%2F04rlf&type=video%2Cplaylist&key=" + config.googleApiKey);
  }

  static rawFetch(url) {
    return new Promise(function(resolve, reject) {
      const re = /(?:watch|playlist)\?(v|list)=([A-Za-z0-9\-_]{8,})/g;
      let res = re.exec(url);

      if (res) {
        let kind = res[1];
        let id = res[2];

        switch (kind) {
          case "v":
            Searcher.get("https://www.googleapis.com/youtube/v3/videos?part=snippet&id=" + id + "&key=" + config.googleApiKey).then(resolve);
            break;
          case "list":
            Searcher.get("https://www.googleapis.com/youtube/v3/playlists?part=snippet%2CcontentDetails&id=" + id + "&key=" + config.googleApiKey).then(resolve);
            break;
        }
      } else {
        reject(Error("Can't parse this url!"));
      }
    });
  }

  static itemBuilder(result) {
    let kind = result.id.kind || result.kind;

    switch (kind) {
      case "youtube#video":
        return new Entry(result.snippet.title, result.snippet.channelTitle, result.snippet.thumbnails.high.url, null, "https://www.youtube.com/watch?v=" + (result.id.videoId || result.id));
        break;
      case "youtube#playlist":
        return new Playlist(result.snippet.title, result.snippet.channelTitle, result.snippet.thumbnails.high.url, result.contentDetails.itemCount, "https://www.youtube.com/playlist?list=" + (result.id.playlistId || result.id));
        break;
    }
  }

  static search(query) {
    return new Promise(function(resolve, reject) {
      YoutubeSearcher.rawSearch(query).then(JSON.parse).then(function(response) {
        let results = [];

        for (var i = 0; i < response.items.length; i++) {
          results.push(YoutubeSearcher.itemBuilder(response.items[i]));
        }

        resolve(results);
      });
    });
  }

  static getUrl(url) {
    return new Promise(function(resolve, reject) {
      YoutubeSearcher.rawFetch(url).then(JSON.parse).then(function(response) {
        let result = YoutubeSearcher.itemBuilder(response.items[0]);

        resolve(result);
      });
    });
  }

  static featured() {
    return new Promise(function(resolve, reject) {
      // Youtube's "music" channel
      const videoChannel = "UC-9-kyTW8ZkZNDHQJ6FgpwQ";
      let url = "https://www.googleapis.com/youtube/v3/playlists?part=snippet%2CcontentDetails&channelId=" + videoChannel + "&maxResults=20&key=" + config.googleApiKey;

      Searcher.get(url).then(JSON.parse).then(function(response) {
        let results = [];

        for (var i = 0; i < response.items.length; i++) {
          results.push(YoutubeSearcher.itemBuilder(response.items[i]));
        }

        resolve(results);
      });
    });
  }
}

class SpotifySearcher extends Searcher {
  static get accessHeader() {
    return new Promise(function(resolve, reject) {
      if (SpotifySearcher.accessToken && SpotifySearcher.accessToken.expires_at > (Date.now() / 1000)) {
        resolve(["Authorization", "Bearer " + SpotifySearcher.accessToken.access_token]);
      } else {
        console.log("[SpotifySearcher] getting new token");
        Searcher.get("http://utils.giesela.org/tokens/spotify", ["Access-Control-Allow-Origin", true]).then(JSON.parse).then(function(accessToken) {
          SpotifySearcher.accessToken = accessToken;
          resolve(["Authorization", "Bearer " + SpotifySearcher.accessToken.access_token]);
        });
      }
    });
  }

  static search(query) {}

  static getUrl(url) {}

  static featured() {
    return new Promise(function(resolve, reject) {
      SpotifySearcher.accessHeader.then(function(header) {
        Searcher.get("https://api.spotify.com/v1/browse/featured-playlists", [header]).then(resolve);
      });
    });
  }
}

class Browser {
  constructor(defaultSearcher) {
    this.searcher = defaultSearcher;
  }

  switchSearcher(newSearcher) {
    this.searcher = newSearcher;
  }

  search(query) {
    return this.searcher.search(query);
  }

  getUrl(url) {
    return this.searcher.getUrl(url);
  }

  featured() {
    return this.searcher.featured();
  }
}

browser = new Browser(SpotifySearcher);
