---
description: Easy way to push code and resolve remote errors
---

To push your code easily without worrying about remote errors, follow these steps:

1. **Check your remotes** (Optional - just to see what's there)
// turbo
```powershell
git remote -v
```

2. **Add and Commit your changes**
```powershell
git add .
git commit -m "Your commit message"
```

3. **Push to the existing remote**
Instead of adding a new remote, just push to the one that already exists (`origin` or `upstream`). Since both point to the same repository in your case, `origin` is the standard one to use.
// turbo
```powershell
git push origin main
```

4. **If you MUST rename a remote** (e.g., if you really want one called `fork`)
// turbo
```powershell
git remote rename origin fork
```
Then you can push using `git push fork main`.

> [!TIP]
> You don't need to run `git remote add` every time. Once a remote is added, it stays there forever!
