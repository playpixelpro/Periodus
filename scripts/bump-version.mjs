#!/usr/bin/env node

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const rootDir = path.resolve(__dirname, '..')

const rawArg = process.argv[2]
if (!rawArg) {
  console.error('\x1b[31mError: Please provide a version number.\x1b[0m')
  console.log('Usage: pnpm run release:bump <version>')
  console.log('Example: pnpm run release:bump 1.2.0')
  process.exit(1)
}

// Clean version string (strip leading 'v' if provided)
const cleanVersion = rawArg.replace(/^v/, '').trim()
const semverRegex = /^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$/
if (!semverRegex.test(cleanVersion)) {
  console.error(`\x1b[31mError: Invalid semver format: "${rawArg}". Expected format: X.Y.Z (e.g. 1.2.0)\x1b[0m`)
  process.exit(1)
}

const tag = `v${cleanVersion}`
console.log(`\n\x1b[36m🚀 Bumping Periodus version to ${cleanVersion} (${tag})...\x1b[0m\n`)

const updatedFiles = []

// 1. Root package.json
const rootPkgPath = path.join(rootDir, 'package.json')
if (fs.existsSync(rootPkgPath)) {
  const pkg = JSON.parse(fs.readFileSync(rootPkgPath, 'utf-8'))
  const oldVer = pkg.version
  pkg.version = cleanVersion
  fs.writeFileSync(rootPkgPath, JSON.stringify(pkg, null, 2) + '\n', 'utf-8')
  updatedFiles.push({ file: 'package.json', change: `${oldVer} → ${cleanVersion}` })
}

// 2. App package.json
const appPkgPath = path.join(rootDir, 'app', 'package.json')
if (fs.existsSync(appPkgPath)) {
  const pkg = JSON.parse(fs.readFileSync(appPkgPath, 'utf-8'))
  const oldVer = pkg.version
  pkg.version = cleanVersion
  fs.writeFileSync(appPkgPath, JSON.stringify(pkg, null, 2) + '\n', 'utf-8')
  updatedFiles.push({ file: 'app/package.json', change: `${oldVer} → ${cleanVersion}` })
}

// 3. app/src/lib/version.ts
const versionTsPath = path.join(rootDir, 'app', 'src', 'lib', 'version.ts')
if (fs.existsSync(versionTsPath)) {
  let content = fs.readFileSync(versionTsPath, 'utf-8')
  const match = content.match(/export const APP_VERSION = '([^']+)'/)
  const oldVer = match ? match[1] : 'unknown'
  content = content.replace(/export const APP_VERSION = '[^']+'/, `export const APP_VERSION = '${cleanVersion}'`)
  fs.writeFileSync(versionTsPath, content, 'utf-8')
  updatedFiles.push({ file: 'app/src/lib/version.ts', change: `${oldVer} → ${cleanVersion}` })
}

// 4. app/android/app/build.gradle
const gradlePath = path.join(rootDir, 'app', 'android', 'app', 'build.gradle')
if (fs.existsSync(gradlePath)) {
  let content = fs.readFileSync(gradlePath, 'utf-8')
  const codeMatch = content.match(/versionCode\s+(\d+)/)
  const nameMatch = content.match(/versionName\s+"([^"]+)"/)
  
  const oldCode = codeMatch ? parseInt(codeMatch[1], 10) : 1
  const newCode = oldCode + 1
  const oldName = nameMatch ? nameMatch[1] : 'unknown'

  content = content.replace(/versionCode\s+\d+/, `versionCode ${newCode}`)
  content = content.replace(/versionName\s+"[^"]+"/, `versionName "${cleanVersion}"`)
  fs.writeFileSync(gradlePath, content, 'utf-8')
  updatedFiles.push({
    file: 'app/android/app/build.gradle',
    change: `versionCode ${oldCode} → ${newCode}, versionName "${oldName}" → "${cleanVersion}"`,
  })
}

// 5. app/ios/App/App.xcodeproj/project.pbxproj (if exists)
const pbxPath = path.join(rootDir, 'app', 'ios', 'App', 'App.xcodeproj', 'project.pbxproj')
if (fs.existsSync(pbxPath)) {
  let content = fs.readFileSync(pbxPath, 'utf-8')
  content = content.replace(/MARKETING_VERSION = [^;]+;/g, `MARKETING_VERSION = ${cleanVersion};`)
  fs.writeFileSync(pbxPath, content, 'utf-8')
  updatedFiles.push({ file: 'app/ios/App/.../project.pbxproj', change: `MARKETING_VERSION → ${cleanVersion}` })
}

// Summary
console.log('\x1b[32m✔ Version bumped successfully across all project files:\x1b[0m')
for (const item of updatedFiles) {
  console.log(`  • \x1b[1m${item.file}\x1b[0m (${item.change})`)
}

console.log('\n\x1b[35mNext steps to publish your release to GitHub:\x1b[0m')
console.log(`  git add -A`)
console.log(`  git commit -m "chore: release ${tag}"`)
console.log(`  git tag ${tag}`)
console.log(`  git push origin main --tags\n`)
console.log('\x1b[33mGitHub Actions will automatically build and publish the release APK.\x1b[0m\n')
