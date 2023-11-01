import fs from "fs"

const User = {
  Get: async () => {
    const data = await fs.promises.readFile("data.txt", "utf8")
    const rows = data.split("\n")
    let users = rows.map((row) => {
      const userId = row.slice(0, 9)
      const done = false
      return { userId, done }
    })
    return users
  },
}

export default User
