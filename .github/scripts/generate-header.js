const fs = require('fs');
const https = require('https');

// GitHub GraphQL API to fetch user data
async function fetchUserData(username, token) {
  const query = `
    query($username: String!) {
      user(login: $username) {
        createdAt
        repositories(first: 100, ownerAffiliations: OWNER) {
          totalCount
        }
        contributionsCollection {
          contributionCalendar {
            totalContributions
            weeks {
              contributionDays {
                contributionCount
                date
                weekday
              }
            }
          }
          totalCommitContributions
        }
      }
    }
  `;

  const data = JSON.stringify({
    query,
    variables: { username }
  });

  const options = {
    hostname: 'api.github.com',
    path: '/graphql',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      'User-Agent': 'GitHub-Profile-Generator'
    }
  };

  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        try {
          const result = JSON.parse(body);
          if (result.errors) {
            reject(new Error(JSON.stringify(result.errors)));
          } else {
            resolve(result.data.user);
          }
        } catch (e) {
          reject(e);
        }
      });
    });

    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

// Map contribution count to color (blue gradient only)
function getContributionColor(count) {
  // Use only blue gradient colors
  if (count === 0) return { color: '#1a1a3e', opacity: 1 };
  if (count < 3) return { color: '#0d3d56', opacity: 1 };
  if (count < 6) return { color: '#00d4ff', opacity: 0.5 };
  if (count < 9) return { color: '#00d4ff', opacity: 0.8 };
  return { color: '#00d4ff', opacity: 1 };
}

// Generate contribution grid SVG
function generateContributionGrid(calendar) {
  let svg = '';
  let delay = 0.1;
  const weeks = calendar.weeks.slice(-52); // Last 52 weeks

  weeks.forEach((week, weekIndex) => {
    const x = weekIndex * 14; // 12px cell + 2px gap

    week.contributionDays.forEach((day) => {
      const y = day.weekday * 15; // 12px cell + 3px gap
      const { color, opacity } = getContributionColor(day.contributionCount);

      svg += `      <rect class="contrib-cell" x="${x}" y="${y}" width="12" height="12" rx="2" fill="${color}" opacity="${opacity}" style="animation-delay: ${delay.toFixed(2)}s"/>\n`;
      delay += 0.01;
    });
  });

  return svg;
}

// Main function
async function main() {
  const username = process.env.GITHUB_REPOSITORY_OWNER || process.env.USERNAME;
  const token = process.env.GITHUB_TOKEN;

  if (!username || !token) {
    console.error('Error: GITHUB_REPOSITORY_OWNER and GITHUB_TOKEN must be set');
    process.exit(1);
  }

  console.log(`Fetching user data for ${username}...`);

  try {
    const userData = await fetchUserData(username, token);
    const calendar = userData.contributionsCollection.contributionCalendar;

    // Calculate stats
    const createdDate = new Date(userData.createdAt);
    const now = new Date();
    const yearsCoding = Math.max(1, Math.floor((now - createdDate) / (365.25 * 24 * 60 * 60 * 1000)));
    const repositories = userData.repositories.totalCount;
    const commits = userData.contributionsCollection.totalCommitContributions;

    console.log(`Years Coding: ${yearsCoding}`);
    console.log(`Repositories: ${repositories}`);
    console.log(`Commits: ${commits}`);
    console.log(`Total contributions: ${calendar.totalContributions}`);
    console.log(`Weeks of data: ${calendar.weeks.length}`);

    // Generate the contribution grid
    const contributionGrid = generateContributionGrid(calendar);

    // Read the SVG template
    let svgTemplate = fs.readFileSync('./header-complete.svg', 'utf8');

    // Replace stats
    svgTemplate = svgTemplate.replace(/{{YEARS_CODING}}/g, `${yearsCoding}+`);
    svgTemplate = svgTemplate.replace(/{{REPOSITORIES}}/g, `${repositories}+`);
    svgTemplate = svgTemplate.replace(/{{COMMITS}}/g, `${commits >= 1000 ? Math.floor(commits / 1000) + 'k' : commits}+`);

    // Replace the contribution grid section
    const gridStart = svgTemplate.indexOf('    <!-- Contribution grid: 52 weeks');
    const gridEnd = svgTemplate.indexOf('    </g>\n\n    <!-- Month labels -->');

    if (gridStart === -1 || gridEnd === -1) {
      throw new Error('Could not find contribution grid markers in SVG template');
    }

    const beforeGrid = svgTemplate.substring(0, gridStart);
    const afterGrid = svgTemplate.substring(gridEnd);

    const newSvg = beforeGrid +
      '    <!-- Contribution grid: 52 weeks (auto-generated) -->\n' +
      '    <g transform="translate(266, 330)">\n' +
      contributionGrid +
      '    </g>\n\n    <!-- Month labels -->' +
      afterGrid;

    // Write the updated SVG
    fs.writeFileSync('./header-complete.svg', newSvg, 'utf8');
    console.log('✓ Successfully generated header-complete.svg with live data');

  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

main();
