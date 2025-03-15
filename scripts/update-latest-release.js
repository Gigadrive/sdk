function isCliRelease(release) {
  return release.tag_name.startsWith('gigadrive@');
}

module.exports = async ({ github, context }) => {
  const { owner, repo } = context.repo;

  const { data: latestRelease } = await github.rest.repos.getLatestRelease({
    owner,
    repo,
  });

  if (isCliRelease(latestRelease)) {
    console.log(`Latest release is "${latestRelease.tag_name}" - skipping`);
    return;
  }

  const response = await github.rest.repos.listReleases({ owner, repo });
  const latestCliRelease = response.data.find(isCliRelease);
  console.log(`Promoting "${latestCliRelease.tag_name}" to latest release`);

  await github.rest.repos.updateRelease({
    owner,
    repo,
    release_id: latestCliRelease.id,
    make_latest: true,
  });
};
