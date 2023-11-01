import fs from "fs"

const User = {
  Get: async () => {
    const data = await fs.promises.readFile("data.txt", "utf8")
    const rows = data.split("\n")
    const regex = /^nm\d+/
    let users = rows.map((row) => {
      const userId = row.match(regex)[0]
      if (userId) {
        const done = false
        return { userId, done }
      }
    })
    return users
  }
}

export default User
