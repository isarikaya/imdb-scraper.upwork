import fs from "fs"
import puppeteer from "puppeteer-extra"
import User from "./services/user.js"
import StealthPlugin from "puppeteer-extra-plugin-stealth"
puppeteer.use(StealthPlugin())
const createDir = async () => {
  const outputDir = fs.existsSync("output")
  try {
    if(!outputDir) {
      await fs.promises.mkdir("./output")
    }
  } catch (err) {}
}

const isDone = async () => {
  const history = fs.existsSync("history.json", "utf8")
  if(history) {
    const history = JSON.parse(await fs.promises.readFile("history.json", "utf8"))
    const nonCompleteds = history.filter(item => !item.completed)
    if(nonCompleteds.length < 1) {
      await fs.promises.unlink("history.json")
    }
  }
}

function convertJSONToTSV(jsonArr, tsvFilePath) {
  let tsv = '';
  const headers = ['fullName', 'userCode', 'bornYear', 'gender', 'title_year', 'title', 'item_code', 'season_episode', 'character'];
  tsv += headers.join('\t') + '\n';

  jsonArr.forEach((item) => {
    if (item.lastResult && item.lastResult.length > 0) {
      item.lastResult.forEach((nestedItem) => {
        let row = headers.map((header) => {
          if (header === 'title_year') {
            return nestedItem.title_year || 'NA';
          } else if (header === 'title') {
            return item.title || 'NA';
          } else if (header === 'character') {
            return nestedItem.character || 'NA';
          } else if (header === 'season_episode') {
            return nestedItem.season_episode || 'NA';
          } else {
            return item[header] || 'NA';
          }
        }).join('\t');
        tsv += row + '\n';
      });
    } else {
      let row = headers.map((header) => {
        if (header === 'title_year') {
          return item.title_year || 'NA';
        } else if (header === 'title') {
          return item.title || 'NA';
        } else {
          return item[header] || 'NA';
        }
      }).join('\t');
      tsv += row + '\n';
    }
  });
  fs.writeFile(tsvFilePath, tsv, (err) => {
    if (err) throw err;
    console.log(`TSV file has been saved as ${tsvFilePath}`);
  });
}

const scrape = async(user, browser) => {
  try {
    await createDir()
    const base = "https://www.imdb.com/name/"
    const page = await browser.newPage()
    const ua = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36";
    await page.setUserAgent(ua);

    const getGender = async () => {
      try {
        await page.waitForSelector('[data-testid="hero__pageTitle"]');
        
        const gender = await page.evaluate(() => {
          const rows = document.querySelector('[data-testid="hero__pageTitle"]').parentElement.querySelectorAll('ul[role="presentation"] li[role="presentation"]');
          
          for (const row of rows) {
            if (row.innerText === "Actor" || row.innerText === "Actress") {
              return row.innerText.toLowerCase();
            }
          }
        });
        return gender;
      } catch (error) {}
    }
    const loadMore = async () => {
      const gender = await getGender()
      const selector = `[data-testid='Filmography'] #${gender}-previous-projects button[data-testid='nm-flmg-paginated-all-${gender}']`
      const loadMoreButtonExists = await page.evaluate(selector => {
        const loadMoreButton = document.querySelector(selector)
        if (loadMoreButton) {
            loadMoreButton.click()
            return true
        }
        return false
      }, selector)
      if (loadMoreButtonExists) {
          await new Promise(r => setTimeout(r, 500))
          await loadMore()
      }
    }
    const seeAllEpisode = async() => {
      const seeAllButton = await page.$("[data-testid='promptable'] .ipc-see-more__text")
      if (seeAllButton) {
        await seeAllButton.click()
        await new Promise(r => setTimeout(r, 250))
        await seeAllEpisode()
      }
    }
    const getEpisodeData = async() => {
      let episodes = []
      episodes = await page.evaluate(() => {
        const regex = /\(\d{4}\)/gm
        const items = Array.from(document.querySelectorAll('[data-testid="promptable"] .ipc-promptable-base__content a.episodic-credits-bottomsheet__menu-item'))
        return items.map(item => {
          const p = item.querySelector("p.sc-9cdb5bcd-1") 
          const season_episode = p.querySelector("ul > li:first-child")?.innerText || ""
          const match = p.querySelector("ul > li:last-child")?.innerText.match(regex)
          const title_year = match ? match[0] : "";
          const character = item.querySelector(".sc-9cdb5bcd-3.wrap-content")?.innerText || ""
          return { season_episode, title_year, character}
        })
      })
      return episodes
    }
    const getEpisodes = async() => {
      let result = []
      const tabs = await page.$$('[data-testid="episodic-navigation-container"] div > ul li.ipc-tab')
      if(tabs && tabs.length > 0) {
        for(const tab of tabs) {
          await tab.click()
          await new Promise(r => setTimeout(r, 1500))
          await seeAllEpisode()
          await new Promise(r => setTimeout(r, 1500))
          const episodes = await getEpisodeData()
          result = [...result, ...episodes]
        }
      } else {
        await seeAllEpisode()
        await new Promise(r => setTimeout(r, 1500))
        result = await getEpisodeData()
      }
      return result
    }
    const getPopupData = async() => {
      const data = {}
      const selector = '[data-testid="promptable"] .sc-688347b3-0 > a.character-summary-episodic-credit > ul'
      const isEpisodesExists = await page.evaluate((sel) => {
        return document.querySelector(sel) !== null;
      }, selector);
      data.title = await page.evaluate(() => {
        return document.querySelector('[data-testid="promptable"] .sc-a78ec4e3-2 .ipc-title a')?.innerText || ""
      })
      data.item_code = await page.evaluate(() => {
        const regex = /tt(\d+)/;
        const itemCodeEl = document.querySelector('[data-testid="promptable"] .sc-a78ec4e3-2 .ipc-title a')
        const match = itemCodeEl?.getAttribute("href")?.match(regex)
        return match ? match[0] : ""
      })
      if(isEpisodesExists) {
        await page.click(selector);
        await new Promise(r => setTimeout(r, 1500))
        data.lastResult = await getEpisodes()
      } else {
        data.title_year = await page.evaluate(() => {
          return document.querySelector('[data-testid="promptable"] .sc-a78ec4e3-2 > ul > li')?.innerText || ""
        })
        data.character = await page.evaluate(() => {
          return document.querySelector('[data-testid="promptable"] .ipc-expandableSection > span > ul')?.innerText || ""
        })
      }
      return [data]
    }
    const previousJobs = async() => {
      let previousJobs = []
      const gender = await getGender()
      const infoButtons = await page.$$(`[data-testid='Filmography'] #${gender}-previous-projects #accordion-item-${gender}-previous-projects .ipc-accordion__item__content_inner > ul > li > button`)
      if(infoButtons && infoButtons.length > 0) {
        for(const btn of infoButtons) {
          await page.evaluate((btn) => btn.click(), btn);
          await new Promise(r => setTimeout(r, 1500))
          let data = await getPopupData()
          previousJobs = [...previousJobs, ...data]
          await page.keyboard.press('Escape')
          await new Promise(r => setTimeout(r, 500))
        }
      }
      return previousJobs
    }

    try {
      let data = []
      if(user && user.ID) {
        console.log("scraping =>", user.ID)
        await page.goto(base + user.ID, {waitUntil: "domcontentloaded"})
        const basicUserData = await page.evaluate(() => {
          const fullName = document.querySelector('[data-testid="hero__pageTitle"]')?.innerText ?? ""
          const born = document.querySelectorAll('[data-testid="birth-and-death-birthdate"] span')[1]?.innerText || ""
          const bornYear = +born.split(",")[1]?.trim() || "-"
          return {fullName, bornYear}
        })
        const fullGender = await getGender()
        if(fullGender === "actor") {
          basicUserData.gender = "M"
        } else if(fullGender === "actress") {
          basicUserData.gender = "F"
        } else {
          basicUserData.gender = ""
        }
        basicUserData.userCode = user.ID
        data.push(basicUserData)
        await loadMore()
        let prevs = await previousJobs()
        const merged = prevs.map(item => {
          const newItem = { ...basicUserData, ...item }
          if (newItem.lastResult) {
            newItem.lastResult = newItem.lastResult.map(lastResultItem => {
              return newItem.lastResult = { ...basicUserData, ...lastResultItem };
            });
          }
          return newItem
        });
        if(merged && merged.length > 0) {
          convertJSONToTSV(merged, "./output/" + user.ID + ".tsv")
        }
        await User.Update(user.ID)
        await isDone()
        await page.close()
      }
    } catch(err) {
      if (err.name === 'TimeoutError') {
        console.log('Navigation timeout exceeded. Continue...');
        await page.close()
      } else {
        await page.close()
        return { error: err.message }
      }
    }
  } catch(err) {console.log(err)}
}

function chunkArray(array, size) {
  const chunkedArr = []
  for (let i = 0; i < array.length; i += size) {
    chunkedArr.push(array.slice(i, i + size))
  }
  return chunkedArr
}

async function processChunk(chunk, browser) {
  await Promise.all(chunk.map(async (users) => {
    await scrape(users, browser);
  }));
}
async function scrapeUsers() {
  await createDir()
  const browser = await puppeteer.launch({headless: "new", args: ['--disable-features=site-per-process']})
  const users = await User.Get()
  const chunks = chunkArray(users, 5)
  for (const chunk of chunks) {
    await processChunk(chunk, browser)
  }
  await browser.close()
}

scrapeUsers()