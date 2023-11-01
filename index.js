import puppeteer from "puppeteer"
import User from "./services/user.js"

(async () => {
  const users = await User.Get()
  const base = "https://www.imdb.com/name/"
  const browser = await puppeteer.launch({
    headless: false
  })
  const page = await browser.newPage()
  let data = []
  let isClickedSeeAllPreviousProject = false
  for await(const user of users) {
    if(user && user.userId) {
      await page.goto(base + user.userId)
      const basicUserData = await page.evaluate(() => {
        const title = document.querySelector('[data-testid="hero__pageTitle"]').innerText
        const born = document.querySelectorAll('[data-testid="birth-and-death-birthdate"] span')[1].innerText
        const bornYear = +born.split(",")[1].trim()
        const gender = document.querySelector('.sc-7c4234bd-0 ul[role="presentation"] li[role="presentation"]').innerText === "Actor" ? "M" : "F"
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
