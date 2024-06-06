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

  const fetchData = async (url) => {
    console.log("Fetching data for ", url);
    try {
      const response = await fetch(
        "https://youtube-comment-analysis-9e60.onrender.com/get-analyzed-comment",
        {
          method: "POST", // Use POST method
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            userName: username,
            videoUrl: url,
          }), // Send username and video URL in the body
        }
      );
  
      if (!response.ok) {
        throw new Error("Network response was not ok");
      }
  
      const data = await response.json();
  
      // Assuming the API returns an object with `positiveComments`, `negativeComments`, and `neutralComments` properties
      let positivePercentage = data.positiveComments;
      let negativePercentage = data.negativeComments;
      let neutralPercentage = data.neutralComments;
  
      console.log(
        "positive comments: ",
        positivePercentage,
        "negative comments: ",
        negativePercentage,
        "neutral comments: ",
        neutralPercentage
      );
  
      // Update the DOM elements with the fetched data
      document.getElementById("positive-percentage").textContent =
        positivePercentage + "%";
      document.getElementById("negative-percentage").textContent =
        negativePercentage + "%";
      document.getElementById("neutral-percentage").textContent =
        neutralPercentage + "%";
      document.getElementById("error-message").style.display = "none"; // Hide error message
    } catch (error) {
      console.error("Error fetching data:", error);
      showErrorMessage();
    }
  };

  // Function to extract tab URL using Chrome Extension API
  const getTabUrl = () => {
    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
      let url = tabs[0].url;
      // Check if the URL is a YouTube video link
      if (url.includes("youtube.com/watch")||url.includes("youtube.com/shorts")) {
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
