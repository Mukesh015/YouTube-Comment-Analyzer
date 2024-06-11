document.addEventListener("DOMContentLoaded", function () {
  // Function to generate a random string
  function randomStr(len, arr) {
    let ans = "";
    for (let i = len; i > 0; i--) {
      ans += arr[Math.floor(Math.random() * arr.length)];
    }
    return ans;
  }

  const username = randomStr(20, "1234567890abcdefghijklmnopqrstuvwxyz");

  // Check if the URL is a valid YouTube video link

  const showErrorMessage = () => {
    document.getElementById("error-message").style.display = "block";
    document.getElementById("positive-percentage").textContent = "N/A";
    document.getElementById("negative-percentage").textContent = "N/A";
    document.getElementById("neutral-percentage").textContent = "N/A";
  };

  const updateComments = (data) => {
    const responseData = JSON.parse(data);
    document.getElementById("positive-percentage").textContent = responseData.positiveComments + "%";
    document.getElementById("negative-percentage").textContent = responseData.negativeComments + "%";
    document.getElementById("neutral-percentage").textContent = responseData.neutralComments + "%";
  };

  const fetchData = (url) => {
    console.log("Fetching data for ", url);

    const eventSource = new EventSource('/get-analyzed-comment');

    eventSource.onmessage = function (event) {
      const data = event.data;

      if (data.startsWith('{')) {
        updateComments(data);
        eventSource.close();
      } else {
        console.log("Status update: ", data);
      }
    };

    fetch("http://127.0.0.1:5000/get-analyzed-comment", {
      method: "POST", // Use POST method
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        userName: username,
        videoUrl: url,
      }), // Send username and video URL in the body
    }).catch((error) => {
      console.error("Error fetching data:", error);
      showErrorMessage();
    });
  };

  // Function to extract tab URL using Chrome Extension API
  const getTabUrl = () => {
    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
      let url = tabs[0].url;
      // Check if the URL is a YouTube video link
      if (url.includes("youtube.com/watch") || url.includes("youtube.com/shorts")) {
        console.log("YouTube video URL:", url); // Log the URL to console
        fetchData(url);
      } else {
        showErrorMessage();
      }
    });
  };

  // Initial URL check
  getTabUrl();

  // Listen for tab changes
  chrome.tabs.onActivated.addListener(function () {
    getTabUrl();
  });

  // Listen for URL changes
  chrome.tabs.onUpdated.addListener(function () {
    getTabUrl();
  });
});
