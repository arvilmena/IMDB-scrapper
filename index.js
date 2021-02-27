const puppeteer = require('puppeteer');
const moment = require('moment');
const fs = require('fs');

const originUrl = 'https://www.imdb.com/search/title/?title_type=feature&release_date=2010-01-01,2021-01-01&user_rating=7.2,10.0&num_votes=300,9999999&languages=en&sort=num_votes,desc'

const runId = moment().format('YYYY-MM-DD__HH-mm-ss');

async function extractMoviesFromPage(page) {
  return page.evaluate(() => {
    let _movies = [];
    const movieNodes = document.querySelectorAll("#main > div > div.lister.list.detail.sub-list > div > div");
    movieNodes.forEach(item => {
      const url = item.querySelector('h3.lister-item-header a')?.href ?? "";
      let imdbId = "";
      if (url) imdbId = url.match(/(tt\d+)/g)?.[0] ?? "";
      let movie = {
        imdbId: imdbId,
        title: item.querySelector('h3.lister-item-header a')?.innerText ?? "",
        url: url,
        year: item.querySelector('h3.lister-item-header span.lister-item-year')?.innerText ?? "",
        thumbnail: item.querySelector('img.loadlate')?.src ?? "",
        description: item.querySelector('div.lister-item-content > p.text-muted:nth-child(4)')?.innerText.trim() ?? "",
        genres: item.querySelector('p span.genre')?.innerText.split(", ").map(string => string.trim()) ?? [],
        certificate: item.querySelector('p span.certificate')?.innerText ?? "",
        runtime: item.querySelector('p span.runtime')?.innerText ?? "",
        imdbRating: item.querySelector('div.ratings-bar .ratings-imdb-rating')?.dataset.value ?? "",
        metaScoreRating: item.querySelector('div.ratings-bar .ratings-metascore span.metascore')?.innerText.trim() ?? "",
        votes: item.querySelector('p.sort-num_votes-visible span[name="nv"]')?.dataset.value ?? "",
        gross: item.querySelector('p.sort-num_votes-visible span[name="nv"]:nth-child(5)')?.dataset.value ?? "",
      };
      _movies.push(movie);
    })
    return {
      movies: _movies,
      nextPage: document.querySelector("#main a.next-page")
    };
  })
}

async function scrapeList(url) {
  console.log('scrape started, run id: ' + runId)
  let movies = [];
  let onLastPage = false;
  const browser = await puppeteer.launch({headless: false});
  let page = await browser.newPage();
  await page.goto(url,{waitUntil: 'domcontentloaded'});
  await page.waitForSelector('p.imdb-footer__copyright')

  while (onLastPage !== true) {
    const response = await extractMoviesFromPage(page)
    movies.push(...response.movies);
    if (response.nextPage) {
      await Promise.all([
        page.waitForNavigation(),
        page.click("#main a.next-page"),
      ]);
    } else {
      onLastPage = true;
    }
  }
  await browser.close();
  return movies;
}

scrapeList(originUrl)
  .then(movies => {
    console.log(movies)
    fs.appendFile('output/' + runId +'.json', JSON.stringify(movies, null, 2), function (err) {
      if (err) throw err;
      console.log('Saved!');
    });
  });
