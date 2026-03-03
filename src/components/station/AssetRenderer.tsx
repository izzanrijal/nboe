interface AssetRendererProps {
  url: string;
  type: string;
}

const AssetRenderer = ({ url, type }: AssetRendererProps) => {
  if (type === "video") {
    return (
      <div className="flex items-center justify-center w-full">
        <video
          src={url}
          autoPlay
          controls
          className="max-h-[60vh] rounded-xl shadow-lg"
        />
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center w-full">
      <img
        src={url}
        alt="Clinical asset"
        className="max-h-[60vh] rounded-xl shadow-lg object-contain"
      />
    </div>
  );
};

export default AssetRenderer;
