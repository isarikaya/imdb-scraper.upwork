import fs from "fs"
import puppeteer from "puppeteer"
import User from "./services/user.js"

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
  const baseKeys = ['fullName', 'bornYear', 'gender', 'userCode', 'title', 'item_code', 'title_year', 'character'];
  const nestedKeys = ['season_episode', 'title_year2', 'character2'];
  const headers = baseKeys.concat(nestedKeys).join('\t');
  tsv = headers + '\n' + tsv;
  jsonArr.forEach((item) => {
    if (item.lastResult) {
      item.lastResult.forEach((nestedItem) => {
        tsv += baseKeys.map(key => item[key] || 'NA').join('\t') + '\t' + 
                nestedKeys.map(key => nestedItem[key] || 'NA').join('\t') + '\n';
      });
    } else {
      tsv += baseKeys.map(key => item[key] || 'NA').join('\t') + '\t' +
              nestedKeys.map(key => 'NA').join('\t') + '\n';
    }
  });
  fs.writeFile(tsvFilePath, tsv, (err) => {
    if (err) throw err;
    console.log(`TSV file has been saved as ${tsvFilePath}`);
  });
}

(async () => {
  await createDir()
  const users = await User.Get()
  const base = "https://www.imdb.com/name/"
  const browser = await puppeteer.launch({headless: "new", args: ['--disable-features=site-per-process']}) //headless old
  const page = await browser.newPage()
  const ua = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36";
  await page.setUserAgent(ua);

  const getGender = async() => {
    return await page.evaluate(() => {
      return document.querySelector('.sc-7c4234bd-0 ul[role="presentation"] li[role="presentation"]')?.innerText.toLowerCase()
    })
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
        const p = item.querySelector("p.sc-d77789e-1")
        const season_episode = p.querySelector("ul > li:first-child")?.innerText || ""
        const match = p.querySelector("ul > li:last-child")?.innerText.match(regex)
        const title_year2 = match ? match[0] : "";
        const character2 = item.querySelector(".sc-d77789e-3.wrap-content")?.innerText || ""
        return { season_episode, title_year2, character2}
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
        await new Promise(r => setTimeout(r, 1000))
        const episodes = await getEpisodeData()
        result = [...result, ...episodes]
      }
    } else {
      await seeAllEpisode()
      await new Promise(r => setTimeout(r, 1000))
      result = await getEpisodeData()
    }
    return result
  }
  const getPopupData = async() => {
    const data = {}
    const isEpisodes = await page.$('[data-testid="promptable"] .sc-688347b3-0 > a.character-summary-episodic-credit > ul')
    data.title = await page.evaluate(() => {
      return document.querySelector('[data-testid="promptable"] .sc-a78ec4e3-2 .ipc-title a')?.innerText || ""
    })
    data.item_code = await page.evaluate(() => {
      const regex = /tt(\d+)/;
      const itemCodeEl = document.querySelector('[data-testid="promptable"] .sc-a78ec4e3-2 .ipc-title a')
      return itemCodeEl?.getAttribute("href")?.match(regex)[0] || ""
    })
    if(isEpisodes) {
      await isEpisodes.click()
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
        await btn.click()
        await new Promise(r => setTimeout(r, 1500))
        let data = await getPopupData()
        previousJobs = [...previousJobs, ...data]
        await page.keyboard.press('Escape')
        await new Promise(r => setTimeout(r, 500))
      }
    }
    return previousJobs
  }

  for await (const user of users) {
    let data = []
    if(user && user.ID) {
      console.log("scraping =>", user.ID)
      await page.goto(base + user.ID)
      const basicUserData = await page.evaluate(() => {
        const fullName = document.querySelector('[data-testid="hero__pageTitle"]')?.innerText ?? ""
        const born = document.querySelectorAll('[data-testid="birth-and-death-birthdate"] span')[1]?.innerText || ""
        const bornYear = +born.split(",")[1]?.trim() || "-"
        const gender = document.querySelector('.sc-7c4234bd-0 ul[role="presentation"] li[role="presentation"]')?.innerText === "Actor" ? "M" : "F" || ""
        return {fullName, bornYear, gender}
      })
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
      convertJSONToTSV(merged, "./output/" + user.ID + ".tsv")
      await User.Update(user.ID)
      await isDone()
    }
  }
  await browser.close()
})()