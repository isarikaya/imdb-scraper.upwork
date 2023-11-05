import fs from "fs"
import puppeteer from "puppeteer"
import User from "./services/user.js"

(async () => {
  const users = await User.Get()
  const base = "https://www.imdb.com/name/"
  const browser = await puppeteer.launch({headless: false})
  const page = await browser.newPage()
  const ua = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.0.0 Safari/537.36";
  await page.setUserAgent(ua);
  let data = []
  for await(const user of users) {
    if(user && user.userId) {
      await page.goto(base + user.userId)
      const basicUserData = await page.evaluate(() => {
        const fullName = document.querySelector('[data-testid="hero__pageTitle"]')?.innerText ?? ""
        const born = document.querySelectorAll('[data-testid="birth-and-death-birthdate"] span')[1]?.innerText || ""
        const bornYear = +born.split(",")[1]?.trim() || "-"
        const gender = document.querySelector('.sc-7c4234bd-0 ul[role="presentation"] li[role="presentation"]')?.innerText === "Actor" ? "M" : "F" || ""
        return {fullName, bornYear, gender}
      })
      basicUserData.userCode = user.userId
      data.push(basicUserData)
    }
  }
  const getGender = async() => {
    return await page.evaluate(() => {
      return document.querySelector('.sc-7c4234bd-0 ul[role="presentation"] li[role="presentation"]')?.innerText.toLowerCase()
    })
  }
  const loadMore = async(mainEl) => {
    const gender = await getGender()
    const selector = `${mainEl} #${gender}-previous-projects .ipc-see-more__text`;
    const loadMoreButton = await page.$(selector); // Örnek bir sınıf adı
    if (loadMoreButton) {
      await loadMoreButton.click()
      await new Promise(r => setTimeout(r, 250))
      await loadMore(mainEl)
    }
  }
  await loadMore("[data-testid='Filmography']")

  const getEpisodeData = async() => {
    let episodes = []
    episodes = await page.evaluate(() => {
      const items = Array.from(document.querySelectorAll('[data-testid="promptable"] .ipc-promptable-base__content a.episodic-credits-bottomsheet__menu-item'))
      return items.map(item => {
        const p = item.querySelector("p.sc-d77789e-1.cpKfbh")
        const season_episode = p.querySelector("ul > li:first-child")?.innerText || ""
        const title_year = p.querySelector("ul > li:last-child")?.innerText
        const character = item.querySelector(".sc-d77789e-3.RsVgK.wrap-content")?.innerText || ""
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
        await loadMore("[data-testid='promptable']")
        await new Promise(r => setTimeout(r, 1000))
        const episodes = await getEpisodeData()
        result = [...result, ...episodes]
      }
    } else {
      await loadMore("[data-testid='promptable']")
      await new Promise(r => setTimeout(r, 1000))
      result = await getEpisodeData()
    }
    return result
  }
  const getPopupData = async() => {
    const data = {}
    const isEpisodes = await page.$('[data-testid="promptable"] .sc-688347b3-0.jwfyaK > a.character-summary-episodic-credit > ul')
    data.title = await page.evaluate(() => {
      return document.querySelector('[data-testid="promptable"] .sc-a78ec4e3-2.ORipO .ipc-title a')?.innerText || ""
    })
    if(isEpisodes) {
      await isEpisodes.click()
      await new Promise(r => setTimeout(r, 1500))
      data.lastResult = await getEpisodes()
    } else {
      data.title_year = await page.evaluate(() => {
        return document.querySelector('[data-testid="promptable"] .sc-a78ec4e3-2.ORipO > ul > li')?.innerText || ""
      })
      data.character = await page.evaluate(() => {
        return document.querySelector('[data-testid="promptable"] .ipc-expandableSection > span > ul > li')?.innerText || ""
      })
    }
    return [data];
  }
  let previousJobs = []
  const openPreviosJob = async() => {
    const gender = await getGender()
    const infoButtons = await page.$$(`[data-testid='Filmography'] #${gender}-previous-projects #accordion-item-${gender}-previous-projects .ipc-accordion__item__content_inner > ul > li > button`);
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
  }
  await openPreviosJob()
  let userData = []
  userData = [...data, ...previousJobs]
  await fs.promises.writeFile(
    "data.json",
    JSON.stringify(userData),
    (err) => {
      if (err) console.log("err=> ", err)
    }
  )
})()