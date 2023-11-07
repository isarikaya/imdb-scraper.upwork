import fs from "fs"

const User = {
  Get: async () => {
    const data = await fs.promises.readFile("data.txt", "utf8")
    const history = fs.existsSync("history.json", "utf8")
    if(history) {
      const history = JSON.parse(await fs.promises.readFile("history.json", "utf8"))
      const nonCompleteds = history.filter(item => !item.completed)
      return nonCompleteds
    } else {
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
      return JSON.parse(await fs.promises.readFile("history.json", "utf8"))
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
