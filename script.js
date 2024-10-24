const API_URL = 'https://long-snowflake-cf70.sd-api.workers.dev/metrics';

async function fetchMetrics(timeRange) {
  try {
    const response = await fetch(`${API_URL}?timeRange=${encodeURIComponent(timeRange)}`);
    if (!response.ok) {
      throw new Error(`Error fetching metrics: ${response.statusText}`);
    }
    const data = await response.json();
    return data.results || data; // Adjust based on your API's response structure
  } catch (error) {
    console.error('Fetch Metrics Error:', error);
    throw error;
  }
}

function processData(metrics) {
  const sourcesSet = new Set();
  const targetsSet = new Set();
  const dataMap = {};

  // Collect all unique source and target regions
  metrics.forEach(metric => {
    const { source_region, target_region, avg_latency, tcp_bitrate, udp_bitrate } = metric;

    sourcesSet.add(source_region);
    targetsSet.add(target_region);

    if (!dataMap[source_region]) {
      dataMap[source_region] = {};
    }

    // Store the three values in the dataMap
    dataMap[source_region][target_region] = {
      avg_latency: avg_latency || null,
      tcp_bitrate: tcp_bitrate || null,
      udp_bitrate: udp_bitrate || null
    };
  });

  const sources = Array.from(sourcesSet).sort();
  const targets = Array.from(targetsSet).sort();

  // Ensure that dataMap has entries for all sources and targets
  sources.forEach(source => {
    if (!dataMap[source]) {
      dataMap[source] = {};
    }
    targets.forEach(target => {
      if (!dataMap[source][target]) {
        dataMap[source][target] = { avg_latency: null, tcp_bitrate: null, udp_bitrate: null };
      }
    });
  });

  return {
    sources,
    targets,
    dataMap
  };
}

function getLatencyClass(latency) {
  if (latency === null) return '';
  if (latency <= 100) return 'good';
  if (latency <= 200) return 'average';
  return 'poor';
}

function renderTable(sources, targets, dataMap) {
  const container = document.getElementById('table-container');
  container.innerHTML = ''; // Clear previous content

  if (sources.length === 0 || targets.length === 0) {
    container.innerHTML = '<p>No data available for the selected time range.</p>';
    return;
  }

  const table = document.createElement('table');

  // Create table header
  const thead = document.createElement('thead');
  const headerRow = document.createElement('tr');

  // Empty top-left cell
  const emptyCell = document.createElement('th');
  emptyCell.innerText = 'Source \\ Target';
  headerRow.appendChild(emptyCell);

  // Add target regions to header
  targets.forEach(target => {
    const th = document.createElement('th');
    th.innerText = target;
    headerRow.appendChild(th);
  });
  thead.appendChild(headerRow);
  table.appendChild(thead);

  // Create table body
  const tbody = document.createElement('tbody');

  sources.forEach(source => {
    const row = document.createElement('tr');

    // Source region cell
    const sourceCell = document.createElement('th');
    sourceCell.innerText = source;
    row.appendChild(sourceCell);

    // Data cells
    targets.forEach(target => {
      const cell = document.createElement('td');
      const data = dataMap[source][target];

      if (data) {
        const { avg_latency, tcp_bitrate, udp_bitrate } = data;

        // Format the cell with all three values
        const latencyText = avg_latency !== null ? `Latency: ${avg_latency.toFixed(2)} ms` : 'Latency: -';
        const tcpText = tcp_bitrate !== null ? `TCP: ${tcp_bitrate.toFixed(2)} Mbps` : 'TCP: -';
        const udpText = udp_bitrate !== null ? `UDP: ${udp_bitrate.toFixed(2)} Mbps` : 'UDP: -';

        cell.innerHTML = `<div>${latencyText}</div><div>${tcpText}</div><div>${udpText}</div>`;

        // Get the latency class and only add it if it's not empty
        const latencyClass = getLatencyClass(avg_latency);
        if (latencyClass) {
          cell.classList.add(latencyClass);
        }
      } else {
        cell.innerText = '-';
      }
      row.appendChild(cell);
    });

    tbody.appendChild(row);
  });

  table.appendChild(tbody);
  container.appendChild(table);
}

async function updateDashboard() {
  const timeRangeSelect = document.getElementById('timeRange');
  const timeRange = timeRangeSelect.value;

  const apiTimeRangeMap = {
    '5m': '5m',
    '1h': '1h',
    '6h': '6h',
    '24h': '24h',
    '7d': '7d'
  };

  const container = document.getElementById('table-container');
  container.innerHTML = '<p class="loading">Loading data...</p>';

  try {
    const metrics = await fetchMetrics(apiTimeRangeMap[timeRange]);
    const { sources, targets, dataMap } = processData(metrics);
    renderTable(sources, targets, dataMap);
  } catch (error) {
    container.innerHTML = `<p class="error">Failed to load data: ${error.message}</p>`;
  }
}

// Event listener for time range selection
document.getElementById('timeRange').addEventListener('change', updateDashboard);

// Initial load
updateDashboard();
