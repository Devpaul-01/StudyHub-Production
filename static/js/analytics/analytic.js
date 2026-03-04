const analyticsDiv = document.getElementById("allAnalytics");

async function loadAnalytics() {
  await loadImpactMetrics();
  await setupHeatmapSection();
  await loadOverview();
  viewAnalytics();
}

/* =========================
   IMPACT METRICS
========================= */
async function loadImpactMetrics() {
  try {
    const response = await api.get("/analytics/impacts");
    if (response.data.status === "success") {
      const details = response.data.data.impact;
      const impactScore = response.data.data.impact_score;

      const div = document.createElement("div");
      div.innerHTML = `
      <div class="impact-container">
        <div class="impact-header">
          <h2>Your Weekly Impact</h2>
          <div class="impact-score" id="impact-score">${impactScore}</div>
        </div>
        <div class="impact-metrics">
          ${Object.entries(details)
            .map(
              ([key, value]) => `
            <div class="metric-card">
              <div class="metric-value">${value}</div>
              <div class="metric-label">${key.replace(/_/g, " ")}</div>
            </div>`
            )
            .join("")}
        </div>
      </div>`;
      analyticsDiv.appendChild(div);
    }
  } catch (err) {
    console.error("Error loading impact metrics:", err);
  }
}

/* =========================
   HEATMAP SECTION
========================= */
async function setupHeatmapSection() {
  const newDiv = document.createElement("div");
  newDiv.innerHTML = `
    <h1 class="heatmap-title">View Activity HeatMap</h1>
    <form id="daysForm">
      <label for="days">Enter number of days between 1 and 90:</label><br><br>
      <input type="number" id="days" name="days" min="1" max="90" required><br><br>
    </form>
    <div class="heatmap-summary" id="heatmap-summary"></div>
    <div class="heatmap-graph" id="heatmap-graph"></div>
  `;
  analyticsDiv.appendChild(newDiv);

  const daysInput = document.getElementById("days");
  daysInput.addEventListener("input", (e) => loadHeatMap(e));
}

/* =========================
   LOAD HEATMAP
========================= */
async function loadHeatMap(e) {
  const days = e.target.value;
  const heatmapGraph = document.getElementById("heatmap-graph");
  const summaryDiv = document.getElementById("heatmap-summary");

  try {
    heatmapGraph.innerHTML = `<div class="loader">Loading Heatmap Data...</div>`;

    const response = await api.get(`/analytics/activity-heatmap?days=${days}`);
    const data = response.data.data.heatmap;
    const summary = response.data.data.summary;

    if (!data || data.length === 0) {
      heatmapGraph.innerHTML = `<div class="heatmap-empty">No Heatmap Data Found</div>`;
      return;
    }

    summaryDiv.innerHTML = `
      <div class="summary-box">
        <h3>${summary.total_score} Total Points</h3>
        <p><b>${summary.active_days}</b> active days out of ${summary.total_days}</p>
        <p>Average Daily Score: <b>${summary.avg_daily_score}</b></p>
        <p>Best Day: <b>${summary.best_day?.date}</b> (${summary.best_day?.score} pts)</p>
        <p>Current Streak: <b>${summary.current_streak}</b> days 🔥</p>
      </div>
    `;

    // Clear graph before new render
    heatmapGraph.innerHTML = "";

    // SVG setup
    const width = 800;
    const height = 140;
    const cellSize = 15;

    const svg = d3
      .select("#heatmap-graph")
      .append("svg")
      .attr("width", width)
      .attr("height", height)
      .attr("class", "heatmap-svg");

    // Align start date to previous Sunday
    const firstDate = new Date(data[0].date);
    const startOfWeek = d3.timeWeek.floor(firstDate);

    // Color scale
    const colorScale = d3
      .scaleSequential()
      .domain([0, 4])
      .interpolator(d3.interpolateGreens);

    // Tooltip
    const tooltip = d3
      .select("body")
      .append("div")
      .attr("class", "heatmap-tooltip")
      .style("opacity", 0);

    // Draw rectangles
    svg
      .selectAll("rect")
      .data(data)
      .enter()
      .append("rect")
      .attr("width", cellSize)
      .attr("height", cellSize)
      .attr(
        "x",
        (d) => d3.timeWeek.count(startOfWeek, new Date(d.date)) * (cellSize + 2)
      )
      .attr("y", (d) => new Date(d.date).getDay() * (cellSize + 2))
      .attr("fill", (d) => colorScale(d.level))
      .on("mouseover", function (event, d) {
        tooltip.transition().duration(100).style("opacity", 1);
        tooltip
          .html(
            `
          <b>${d.date}</b><br>
          Score: ${d.score}<br>
          Posts: ${d.posts}<br>
          Comments: ${d.comments}<br>
          Helpful: ${d.helpful}<br>
          Messages: ${d.messages}
        `
          )
          .style("left", event.pageX + 10 + "px")
          .style("top", event.pageY - 28 + "px");
      })
      .on("mouseout", () =>
        tooltip.transition().duration(200).style("opacity", 0)
      );
  } catch (error) {
    console.error("Error loading heatmap:", error);
    heatmapGraph.innerHTML = `<div class="heatmap-error">Failed to Load Data</div>`;
  }
}

/* =========================
   OVERVIEW SECTION
========================= */
async function loadOverview() {
  const div = document.createElement("div");
  div.classList.add("overview-div");

  try {
    div.innerHTML = `<div class="overview-loader">Loading Overview Stats...</div>`;
    const response = await api.get("/analytics/overview");

    if (response.data.status === "success") {
      const quickFacts = response.data.data.quick_facts;
      const hero = response.data.data.hero_stats;
      const current = response.data.data.current_stats;

      div.innerHTML = `
        <div class="stat-card hero">
          <h4>Performance</h4>
          <p>Monthly Views: <b>${hero.monthly_views}</b></p>
          <p>Helpful Count: <b>${hero.helpful_count}</b></p>
          <p>Activity Level: <b>${hero.activity_level}</b></p>
        </div>
        <div class="stat-card current">
          <h4>Profile Stats</h4>
          <p>Total Posts: <b>${current.total_posts}</b></p>
          <p>Total Reputation: <b>${current.total_reputation}</b></p>
          <p>Login Streak: <b>${current.login_streak}</b> days 🔥</p>
        </div>
        <div class="stat-card facts">
          <h4>Quick Facts</h4>
          <p>Joined: <b>${new Date(
            quickFacts.joined_at
          ).toLocaleDateString()}</b></p>
          <p>Department: <b>${quickFacts.department || "—"}</b></p>
          <p>Days Active: <b>${quickFacts.days_active}</b></p>
        </div>`;
      analyticsDiv.appendChild(div);
    }
  } catch (err) {
    console.error("Error loading overview:", err);
  }
}

function viewAnalytics() {
  const div = document.createElement("div");
  div.innerHTML = `
    <div class="view-analytics" id="view-analytics">
      <button class="view-analytics-btn" onclick="window.location.href='/student/analytics'">
        View Full Analytics Dashboard
      </button>
    </div>
  `;
  analyticsDiv.appendChild(div);
}