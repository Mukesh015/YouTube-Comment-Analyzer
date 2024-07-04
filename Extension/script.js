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
    console.log("Showing error message: Invalid URL");
    const errorMessage = document.getElementById("error-message");
    const positivePercentage = document.getElementById("positive-percentage");
    const negativePercentage = document.getElementById("negative-percentage");
    const neutralPercentage = document.getElementById("neutral-percentage");
    const validUrl = document.getElementById("valid-url");
    const fetchCommentsBtn = document.getElementById("fetch-comments-btn");

    if (errorMessage) errorMessage.style.display = "block";
    if (positivePercentage) positivePercentage.textContent = "N/A";
    if (negativePercentage) negativePercentage.textContent = "N/A";
    if (neutralPercentage) neutralPercentage.textContent = "N/A";
    if (validUrl) validUrl.textContent = "This is not a valid URL";
    if (fetchCommentsBtn) fetchCommentsBtn.style.display = "none";
  };

  const updateStatus = (message) => {
    console.log("Updating status: ", message);
    const validUrl = document.getElementById("valid-url");
    if (validUrl) validUrl.textContent = message;
  };

  const updateComments = (data) => {
    const responseData = JSON.parse(data);
    console.log("Update comments with data: ", responseData);

    const commentsContainer = document.querySelector(".comments-container");
    const posCmtBox = document.querySelector(".pos-cmt");
    const negCmtBox = document.querySelector(".neg-cmt");
    const neutralCmtBox = document.querySelector(".neutral-cmt");

    if (
      responseData.positiveComments !== undefined &&
      responseData.negativeComments !== undefined &&
      responseData.neutralComments !== undefined
    ) {
      const positivePercentage = document.getElementById("positive-percentage");
      const negativePercentage = document.getElementById("negative-percentage");
      const neutralPercentage = document.getElementById("neutral-percentage");

      if (positivePercentage) {
        positivePercentage.textContent =
          (
            (responseData.positiveComments / responseData.totalComments) *
            100
          ).toFixed(2) + "%";
      }
      if (negativePercentage) {
        negativePercentage.textContent =
          (
            (responseData.negativeComments / responseData.totalComments) *
            100
          ).toFixed(2) + "%";
      }
      if (neutralPercentage) {
        neutralPercentage.textContent =
          (
            (responseData.neutralComments / responseData.totalComments) *
            100
          ).toFixed(2) + "%";
      }
      if (posCmtBox) posCmtBox.style.display = "block";
      if (negCmtBox) negCmtBox.style.display = "block";
      if (neutralCmtBox) neutralCmtBox.style.display = "block";
      const updateStatusEl = document.getElementById("update-status");
      if (updateStatusEl) updateStatusEl.style.display = "none";
    } else {
      if (posCmtBox) posCmtBox.style.display = "none";
      if (negCmtBox) negCmtBox.style.display = "none";
      if (neutralCmtBox) neutralCmtBox.style.display = "none";

      const updateStatusEl = document.getElementById("update-status");
      if (responseData.totalComments !== undefined) {
        console.log(responseData.totalComments);
        if (updateStatusEl) {
          updateStatusEl.textContent = `Total comments ${responseData.totalComments} fetched, analyzing comments...`;
        }
      } else if (responseData.videoId !== undefined) {
        console.log(responseData.videoId);
        if (updateStatusEl) {
          updateStatusEl.textContent = `Fetching comments from video ID: ${responseData.videoId}`;
        }
      } else {
        if (updateStatusEl)
          updateStatusEl.textContent = "This is not a valid URL";
      }
    }
  };

  const fetchData = (url) => {
    console.log("Fetching data for ", url);

    fetch(
      "https://youtube-comment-analysis-9e60.onrender.com/get-analyzed-comment",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userName: username,
          videoUrl: url,
        }),
      }
    )
      .then((response) => response.json())
      .then((data) => {
        updateStatus(data.message);

        if (
          data.message ===
          "Processing started. Check the result click fetch button"
        ) {
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
        .then((response) => response.json())
        .then((data) => {
          if (
            data.status &&
            !data.status.startsWith("Error during processing")
          ) {
            console.log("Polling result: ", data);
            clearInterval(interval);
            updateComments(JSON.stringify(data));
          } else if (
            data.totalComments !== undefined ||
            data.videoId !== undefined
          ) {
            updateComments(JSON.stringify(data));
          } else {
            console.log("Polling result: ", data);
          }
        })
        .catch((error) => {
          console.error("Error polling data:", error);
          clearInterval(interval);
          showErrorMessage();
        });
    }, 5000); // Poll every 5 seconds
  };

  const getTabUrl = () => {
    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
      let url = tabs[0].url;
      if (
        url.includes("youtube.com/watch") ||
        url.includes("youtube.com/shorts")
      ) {
        console.log("YouTube video URL:", url);

        document
          .getElementById("fetch-comments-btn")
          .addEventListener("click", () => {
            const commentsContainer = document.querySelector(
              ".comments-container"
            );
            const fetchBtn = document.getElementById("fetch-comments-btn");

            document.getElementById("valid-url").textContent = "";

            if (
              commentsContainer.style.display === "none" ||
              commentsContainer.style.display === ""
            ) {
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
