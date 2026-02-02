// Unix timestamp in seconds
const RETURN_TIMESTAMP = 1772323200; // ~ March 1st, 2026

const SITE_NAME = "Zunalita";

// Format date from Unix epoch format
function formatDateFromUnix(timestamp) {
  const date = new Date(timestamp * 1000);

  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

const formattedDate = formatDateFromUnix(RETURN_TIMESTAMP);

const messageTemplate = `
  ${SITE_NAME} is currently undergoing a full revamp, ensuring a better
  experience for its users.
  At the moment, there is no guaranteed return date, but we expect it to be
  back around <strong>${formattedDate}</strong>.
  Thank you for using ${SITE_NAME}!
`;

// Render message
document.getElementById("maintenance-message").innerHTML = messageTemplate;
