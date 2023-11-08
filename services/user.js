import fs from "fs"

const User = {
  Get: async () => {
    const startFile = fs.existsSync("data.txt", "utf8")
    const history = fs.existsSync("history.json", "utf8")
    if(history) {
      const history = JSON.parse(await fs.promises.readFile("history.json", "utf8"))
      const nonCompleteds = history.filter(item => !item.completed)
      console.log('non completeds', nonCompleteds.length)
      if(nonCompleteds.length < 1) {
        await fs.promises.unlink("history.json")
        return User.Get()
      } else {
        return nonCompleteds
      }
    } else {
      if(startFile) {
        const data = await fs.promises.readFile("data.txt", "utf8")
        const rows = data.split("\n")
        const regex = /^nm\d+/
        let users = rows.map((row) => {
          const ID = row.match(regex)[0]
          if (ID) {
            const completed = false
            return { ID, completed }
          }
        })
        await fs.promises.writeFile("history.json", JSON.stringify(users))
        await fs.promises.unlink("data.txt")
        return JSON.parse(await fs.promises.readFile("history.json", "utf8"))
      }
    }
  },
  Update: async (id) => {
    const history = JSON.parse(await fs.promises.readFile("history.json", "utf8"))
    const index = history.findIndex(item => item.ID === id)
    if(index !== -1) {
      history[index].completed = true
    }
    await fs.promises.writeFile("history.json", JSON.stringify(history, null, 2))
    console.log(id + " done.")
  }
}

export default User
