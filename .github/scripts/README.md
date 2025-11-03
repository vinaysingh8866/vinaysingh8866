# GitHub Profile Header Generator

This script automatically generates your GitHub profile header with **live contribution data** from the GitHub API.

## How It Works

1. **GitHub Actions Workflow** (`.github/workflows/update-profile-header.yml`) runs:
   - Daily at 00:00 UTC
   - On manual trigger via workflow_dispatch
   - When the generator script is modified

2. **Data Fetching** (`generate-header.js`):
   - Uses GitHub GraphQL API to fetch your last 52 weeks of contributions
   - Retrieves contribution counts for each day
   - Maps contribution counts to blockchain-themed colors

3. **SVG Generation**:
   - Reads the `header-complete.svg` template
   - Replaces the contribution grid section with live data
   - Adds pulsing animations to high-activity days
   - Commits the updated SVG back to the repository

## Color Mapping

Contributions are mapped to custom blockchain-themed colors:

| Contribution Count | Color | Hex |
|-------------------|-------|-----|
| 0 | Dark | #1a1a3e |
| 1-2 | Dark Blue | #0d3d56 |
| 3-5 | Cyan | #00d4ff |
| 6-8 | Purple | #7b2ff7 |
| 9+ | Pink | #f107a3 |

## Manual Trigger

To manually update your profile header:

1. Go to the [Actions tab](../../actions/workflows/update-profile-header.yml)
2. Click "Run workflow"
3. Select the main branch
4. Click "Run workflow"

## Local Testing

```bash
# Set environment variables
export GITHUB_TOKEN="your_github_token"
export USERNAME="your_github_username"

# Run the script
node .github/scripts/generate-header.js
```

## Requirements

- Node.js 18+
- GitHub token with `repo` scope
- The `header-complete.svg` file in the repository root
