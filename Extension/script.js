document.addEventListener("DOMContentLoaded", function () {
  function randomStr(len, arr) {
    let ans = "";
    for (let i = len; i > 0; i--) {
      ans += arr[Math.floor(Math.random() * arr.length)];
    }
    return ans;
  }

  const username = randomStr(20, "1234567890abcdefghijklmnopqrstuvwxyz");

  const showErrorMessage = () => {
    document.getElementById("error-message").style.display = "block";
    document.getElementById("positive-percentage").textContent = "N/A";
    document.getElementById("negative-percentage").textContent = "N/A";
    document.getElementById("neutral-percentage").textContent = "N/A";
  };

  const updateStatus = (message) => {
    document.getElementById("valid-url").textContent = message;
  };

  const updateComments = (data) => {
    const responseData = JSON.parse(data);
  

    const commentsContainer = document.querySelector(".comments-container");
    const posCmtBox = document.querySelector(".pos-cmt");
    const negCmtBox = document.querySelector(".neg-cmt");
    const neutralCmtBox = document.querySelector(".neutral-cmt");

    if (responseData.positiveComments !== undefined && responseData.negativeComments !== undefined && responseData.neutralComments !== undefined) {
      document.getElementById("positive-percentage").textContent = ((responseData.positiveComments / responseData.totalComments) * 100).toFixed(2) + "%";
      document.getElementById("negative-percentage").textContent = ((responseData.negativeComments / responseData.totalComments) * 100).toFixed(2) + "%";
      document.getElementById("neutral-percentage").textContent = ((responseData.neutralComments / responseData.totalComments) * 100).toFixed(2) + "%";
      posCmtBox.style.display = "block";
      negCmtBox.style.display = "block";
      neutralCmtBox.style.display = "block";
      document.getElementById("update-status").style.display = "none";
    } else {
      posCmtBox.style.display = "none";
      negCmtBox.style.display = "none";
      neutralCmtBox.style.display = "none";

      if (responseData.totalComments !== undefined) {
        console.log(responseData.totalComments)
        // updateStatus(`Total comments ${responseData.totalComments} fetched, analyzing comments...`);
        document.getElementById("update-status").textContent=`Total comments ${responseData.totalComments} fetched, analyzing comments...` ;
      } else if (responseData.videoId !== undefined) {
        console.log(responseData.videoId)
        // updateStatus(`Fetching comments from video ID: ${responseData.videoId}`);
        document.getElementById("update-status").textContent=`Fetching comments from video ID: ${responseData.videoId}`
      } else {
        // updateStatus("No relevant data available.");
        document.getElementById("update-status").textContent="this is not a valid URL"

      }
    }
  };

  const fetchData = (url) => {
    console.log("Fetching data for ", url);

    fetch("https://youtube-comment-analysis-9e60.onrender.com/get-analyzed-comment", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        userName: username,
        videoUrl: url,
      }),
    })
      .then(response => response.json())
      .then(data => {
        updateStatus(data.message);

        if (data.message === "Processing started. Check the result click fetch button") {
          pollForResult(username);
        } 
      })
      .catch((error) => {
        console.error("Error fetching data:", error);
        showErrorMessage();
      });
  };

  const pollForResult = (user) => {
    console.log("Polling result for ", user);
    const interval = setInterval(() => {
      fetch(`https://youtube-comment-analysis-9e60.onrender.com/result/${user}`)
        .then(response => response.json())
        .then(data => {
          if (data.status && !data.status.startsWith("Error during processing")) {
            clearInterval(interval);
            updateComments(JSON.stringify(data));
          }
          else if (data.totalComments !== undefined || data.videoId !== undefined) {
            updateComments(JSON.stringify(data));
          }
           else {
            console.log("Polling result: ", data);
          }
        })
        .catch(error => {
          console.error("Error polling data:", error);
          clearInterval(interval);
          showErrorMessage();
        });
    }, 5000); // Poll every 5 seconds
  };

  const getTabUrl = () => {
    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
      let url = tabs[0].url;
      if (url.includes("youtube.com/watch") || url.includes("youtube.com/shorts")) {
        console.log("YouTube video URL:", url);

        document.getElementById("fetch-comments-btn").addEventListener("click", () => {
          const commentsContainer = document.querySelector(".comments-container");
          const fetchBtn = document.getElementById("fetch-comments-btn");

          document.getElementById("valid-url").textContent = "";

          if (commentsContainer.style.display === "none" || commentsContainer.style.display === "") {
            commentsContainer.style.display = "block";
          } else {
            commentsContainer.style.display = "none";
          }
          fetchBtn.style.display = "none";
        });

        fetchData(url);
      } else {
        showErrorMessage();
      }
    });
  };

  getTabUrl();

  chrome.tabs.onActivated.addListener(function () {
    getTabUrl();
  });

  chrome.tabs.onUpdated.addListener(function () {
    getTabUrl();
  });
});
