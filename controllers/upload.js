const cloudinary = require("cloudinary").v2;
const streamifier = require("streamifier");

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const uploadFile = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: { message: "No file uploaded" } });
    }

    const { fieldname, originalname, encoding, mimetype, size } = req.file;
    const resourceType = req.body.resourceType || "auto";

    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: "tca_uploads", // Optional: specify a folder name
        resource_type: resourceType,
      },
      (error, result) => {
        if (error) {
          console.error("Cloudinary Upload Error:", error);
          return res.status(500).json({
            error: {
              message: error.message || "Failed to upload to Cloudinary",
            },
          });
        }
        res.status(200).json(result);
      }
    );

    streamifier.createReadStream(req.file.buffer).pipe(uploadStream);
  } catch (error) {
    console.error("Upload Error:", error);
    res.status(500).json({ error: { message: "Internal server error during upload" } });
  }
};

module.exports = {
  uploadFile,
};
