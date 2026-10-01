const fs = require('fs');
const https = require('https');

// GitHub GraphQL API to fetch user data
async function fetchUserData(username, token) {
  const query = `
    query($username: String!) {
      user(login: $username) {
        createdAt
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

// Thresholds from the quartiles of active days, so the shading adapts to the user's activity level
function getThresholds(days) {
  const counts = days.map((d) => d.contributionCount).filter((c) => c > 0).sort((a, b) => a - b);
  if (counts.length === 0) return [1, 1, 1];
  const q = (p) => counts[Math.floor((counts.length - 1) * p)];
  return [q(0.25), q(0.5), q(0.75)];
}

// Map contribution count to color (blue gradient only)
function getContributionColor(count, [q1, q2, q3]) {
  if (count === 0) return { color: '#1a1a3e', opacity: 1 };
  if (count <= q1) return { color: '#0d3d56', opacity: 1 };
  if (count <= q2) return { color: '#00d4ff', opacity: 0.5 };
  if (count <= q3) return { color: '#00d4ff', opacity: 0.8 };
  return { color: '#00d4ff', opacity: 1 };
}

// Generate contribution grid SVG
function generateContributionGrid(calendar) {
  let svg = '';
  let delay = 0.1;
  const weeks = calendar.weeks.slice(-52); // Last 52 weeks
  const thresholds = getThresholds(weeks.flatMap((week) => week.contributionDays));

  weeks.forEach((week, weekIndex) => {
    const x = weekIndex * 14; // 12px cell + 2px gap

    week.contributionDays.forEach((day) => {
      const y = day.weekday * 15; // 12px cell + 3px gap
      const { color, opacity } = getContributionColor(day.contributionCount, thresholds);

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
    // Use total contributions (all activity) instead of just commits
    const totalContributions = calendar.totalContributions;

    console.log(`Years Coding: ${yearsCoding}`);
    console.log(`Total Contributions: ${totalContributions}`);
    console.log(`Weeks of data: ${calendar.weeks.length}`);

    // Generate the contribution grid
    const contributionGrid = generateContributionGrid(calendar);

    // Read the SVG template (use template file, not complete file)
    let svgTemplate = fs.readFileSync('./header-template.svg', 'utf8');

    // Replace stats placeholders
    svgTemplate = svgTemplate.replace(/{{YEARS_CODING}}/g, `${yearsCoding}+`);
    svgTemplate = svgTemplate.replace(/{{CONTRIBUTIONS}}/g, `${totalContributions >= 1000 ? (totalContributions / 1000).toFixed(1) + 'k' : totalContributions}+`);

    // Replace the contribution grid placeholder
    const gridContent =
      '    <!-- Contribution grid: 52 weeks (auto-generated) -->\n' +
      '    <g transform="translate(266, 330)">\n' +
      contributionGrid +
      '    </g>\n';

    svgTemplate = svgTemplate.replace(/    <!-- Contribution grid placeholder -->\n    {{CONTRIBUTION_GRID}}\n/g, gridContent);

    // Write the updated SVG to header-complete.svg
    fs.writeFileSync('./header-complete.svg', svgTemplate, 'utf8');
    console.log('✓ Successfully generated header-complete.svg from template with live data');

  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

main();
