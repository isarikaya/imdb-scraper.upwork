import puppeteer from "puppeteer"
import User from "./services/user.js"

(async () => {
  const users = await User.Get()
  const base = "https://www.imdb.com/name/"
  const browser = await puppeteer.launch({headless: "new"})
  const page = await browser.newPage()
  const ua = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.0.0 Safari/537.36";
  await page.setUserAgent(ua);
  let data = []
  let isClickedSeeAllPreviousProject = false
  for await(const user of users) {
    if(user && user.userId) {
      await page.goto(base + user.userId)
      const deneme = await page.waitForSelector("#__next > main > div > section.ipc-page-background.ipc-page-background--base.sc-304f99f6-0.eaRXHu > section > div:nth-child(4) > section > section > div.sc-e226b0e3-3.jJsEuz > div > h1")
      console.log(deneme)
      const basicUserData = await page.evaluate(() => {
        const title = document.querySelector('[data-testid="hero__pageTitle"]')?.innerText ?? "abc"
        const born = document.querySelectorAll('[data-testid="birth-and-death-birthdate"] span')[1]?.innerText || ""
        const bornYear = +born.split(",")[1]?.trim() || "-"
        const gender = document.querySelector('.sc-7c4234bd-0 ul[role="presentation"] li[role="presentation"]')?.innerText === "Actor" ? "M" : "F" || ""
        return {title, bornYear, gender}
      })
      basicUserData.userCode = user.userId
      isClickedSeeAllPreviousProject = await page.evaluate(() => {
        let isClicked = false
        const actressPreviousProjects = document.querySelector("#actress-previous-projects")
        const actorPreviousProjects = document.querySelector("#actor-previous-projects")
        if(actressPreviousProjects) {
          const isButton = actressPreviousProjects.querySelector(".ipc-see-more__button")
          if(isButton) {
            if(isButton) {
              isButton.click()
              isClicked = true
            }
          }
        }
        if(actorPreviousProjects) {
          const isButton = actorPreviousProjects.querySelector(".ipc-see-more__button")
          if(isButton) {
            isButton.click()
            isClicked = true
          }
        }
        return isClicked
      })
      await new Promise((resolve) => setTimeout(resolve, 1000))
      
      data.push(basicUserData)
    }
  }
  console.log(data)
})()