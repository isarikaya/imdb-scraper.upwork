import fs from "fs"

const User = {
  Get: async () => {
    const data = await fs.promises.readFile("data.txt", "utf8")
    const rows = data.split("\n")
    const regex = /^nm\d+/
    let users = rows.map((row) => {
      const userId = row.match(regex)[0]
      if (userId) {
        const completed = false
        return { userId, completed }
      }
    })
    await fs.promises.writeFile("history.json", JSON.stringify(users))
    return JSON.parse(await fs.promises.readFile("history.json", "utf8"))
  }
}

export default User
