import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const pages = ['home', 'activities', 'profile', 'trip', 'signup']
const tabs = ['home', 'activities', 'profile']
const packageJson = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'))
const projectConfig = JSON.parse(readFileSync(resolve(root, 'project.config.json'), 'utf8'))
const privateProjectConfig = JSON.parse(readFileSync(resolve(root, 'project.private.config.json'), 'utf8'))

for (const page of pages) {
  for (const file of ['index.tsx', 'index.module.scss', 'index.config.ts']) {
    assert.ok(
      existsSync(resolve(root, `src/pages/${page}/${file}`)),
      `missing page file: src/pages/${page}/${file}`
    )
  }
}

assert.equal(existsSync(resolve(root, 'src/pages/index/index.tsx')), false)
assert.equal(packageJson.devDependencies['@tarojs/cli'], '4.1.9')
assert.equal(projectConfig.setting.urlCheck, false)
assert.equal(privateProjectConfig.setting.urlCheck, false)

for (const tab of tabs) {
  for (const suffix of ['', '-selected']) {
    assert.ok(
      existsSync(resolve(root, `src/assets/tabbar/${tab}${suffix}.png`)),
      `missing tab icon: ${tab}${suffix}.png`
    )
  }
}

const appConfig = readFileSync(resolve(root, 'src/app.config.ts'), 'utf8')
for (const page of pages) {
  assert.match(appConfig, new RegExp(`pages/${page}/index`))
}
assert.doesNotMatch(appConfig, /iconPath:\s*'[^']+\.svg'/)
assert.doesNotMatch(appConfig, /selectedIconPath:\s*'[^']+\.svg'/)

const apiSource = readFileSync(resolve(root, 'src/services/api.ts'), 'utf8')
assert.match(apiSource, /CLOUD_API_BASE_URL/)
assert.match(apiSource, /ap-shanghai\.app\.tcloudbase\.com/)
assert.match(apiSource, /useLocalMock/)
assert.match(apiSource, /getAccountInfoSync/)
assert.match(apiSource, /envVersion\s*===\s*'release'/)
assert.match(apiSource, /Taro\.request/)
assert.match(apiSource, /\/api\/v1\/activities/)
assert.match(apiSource, /\/api\/v1\/auth\/wechat/)
assert.match(apiSource, /authorization/i)
assert.doesNotMatch(apiSource, /TARO_ENV/)
assert.doesNotMatch(apiSource, /\bprocess\b/)
assert.ok(existsSync(resolve(root, 'src/services/localMock.ts')))

const localMockSource = readFileSync(resolve(root, 'src/services/localMock.ts'), 'utf8')
assert.match(localMockSource, /ACTIVITIES_KEY/)
assert.match(localMockSource, /SIGNUPS_KEY/)
assert.match(localMockSource, /seedLocalMockDb/)
assert.match(localMockSource, /Taro\.setStorageSync/)

const profileSource = readFileSync(resolve(root, 'src/pages/profile/index.tsx'), 'utf8')
assert.match(profileSource, /getMySignups/)
assert.match(profileSource, /getSignupMatch/)
assert.doesNotMatch(profileSource, /loadSignup/)

const signupSource = readFileSync(resolve(root, 'src/pages/signup/index.tsx'), 'utf8')
assert.match(signupSource, /activityId/)
assert.match(signupSource, /requestMatchSubscription/)
assert.match(signupSource, /Taro\.chooseLocation/)
assert.match(signupSource, /pickupLat/)

const buildConfig = readFileSync(resolve(root, 'config/index.ts'), 'utf8')
assert.doesNotMatch(buildConfig, /vite-plugin-imp/)

const tripSource = readFileSync(resolve(root, 'src/pages/trip/index.tsx'), 'utf8')
assert.doesNotMatch(tripSource, /picsum\.photos/)
assert.doesNotMatch(tripSource, /ap-shanghai\.app\.tcloudbase\.com/)

const activitiesPage = readFileSync(resolve(root, 'src/pages/activities/index.tsx'), 'utf8')
assert.match(activitiesPage, /SearchBar/)
assert.match(activitiesPage, /REGIONS/)

const homeSource = readFileSync(resolve(root, 'src/pages/home/index.tsx'), 'utf8')
assert.doesNotMatch(homeSource, /ap-shanghai\.app\.tcloudbase\.com/)

const signupPageSourceForAssets = readFileSync(resolve(root, 'src/pages/signup/index.tsx'), 'utf8')
assert.doesNotMatch(signupPageSourceForAssets, /ap-shanghai\.app\.tcloudbase\.com/)

assert.match(tripSource, /routeSketch/)
assert.match(tripSource, /highlights/)

const theme = readFileSync(resolve(root, 'src/styles/theme.scss'), 'utf8')
assert.match(theme, /#f7f4ed/i)
assert.match(theme, /\$color-accent-red/)
assert.match(theme, /\$color-accent-teal/)

console.log('Miniapp project contract passed.')
