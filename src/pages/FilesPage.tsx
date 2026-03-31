import { useEffect, useState, useRef } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Upload, FileText, Image, Trash2, Download, Loader2, FolderOpen, Search,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface StorageFile {
  name: string;
  id: string;
  created_at: string;
  metadata: { size: number; mimetype: string } | null;
}

export default function FilesPage() {
  const { profile } = useAuth();
  const [files, setFiles] = useState<StorageFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);

  const bucketName = "business-files";
  const folderPath = profile?.business_id ?? "";

  const loadFiles = async () => {
    if (!profile?.business_id) return;
    setLoading(true);
    const { data, error } = await supabase.storage
      .from(bucketName)
      .list(folderPath, { limit: 200, sortBy: { column: "created_at", order: "desc" } });
    if (error) { toast.error("Failed to load files"); console.error(error); }
    else setFiles((data ?? []).filter((f) => f.name !== ".emptyFolderPlaceholder") as StorageFile[]);
    setLoading(false);
  };

  useEffect(() => { loadFiles(); }, [profile?.business_id]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = e.target.files;
    if (!selectedFiles || !profile?.business_id) return;
    setUploading(true);
    let count = 0;
    for (const file of Array.from(selectedFiles)) {
      if (file.size > 20 * 1024 * 1024) { toast.error(`${file.name} exceeds 20MB limit`); continue; }
      const path = `${folderPath}/${Date.now()}-${file.name}`;
      const { error } = await supabase.storage.from(bucketName).upload(path, file);
      if (error) toast.error(`Failed: ${file.name}`);
      else count++;
    }
    if (count > 0) { toast.success(`${count} file(s) uploaded`); loadFiles(); }
    setUploading(false);
    if (fileInput.current) fileInput.current.value = "";
  };

  const handleDelete = async (fileName: string) => {
    const { error } = await supabase.storage.from(bucketName).remove([`${folderPath}/${fileName}`]);
    if (error) toast.error("Delete failed");
    else { toast.success("File deleted"); loadFiles(); }
  };

  const handleDownload = async (fileName: string) => {
    const { data, error } = await supabase.storage.from(bucketName).download(`${folderPath}/${fileName}`);
    if (error || !data) { toast.error("Download failed"); return; }
    const url = URL.createObjectURL(data);
    const a = document.createElement("a");
    a.href = url; a.download = fileName; a.click();
    URL.revokeObjectURL(url);
  };

  const getIcon = (name: string) => {
    const ext = name.split(".").pop()?.toLowerCase() ?? "";
    if (["jpg", "jpeg", "png", "gif", "webp", "svg"].includes(ext)) return <Image className="h-5 w-5 text-blue-500" />;
    return <FileText className="h-5 w-5 text-muted-foreground" />;
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const filtered = files.filter((f) => f.name.toLowerCase().includes(searchTerm.toLowerCase()));

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="font-display text-2xl font-bold">Files</h1>
            <p className="text-muted-foreground text-sm mt-1">Upload and manage business documents</p>
          </div>
          <div>
            <input ref={fileInput} type="file" multiple className="hidden" onChange={handleUpload} />
            <Button onClick={() => fileInput.current?.click()} disabled={uploading}>
              {uploading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
              Upload Files
            </Button>
          </div>
        </div>

        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search files..." className="pl-9" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
            <FolderOpen className="h-12 w-12 mb-3 opacity-40" />
            <p className="text-sm">{searchTerm ? "No matching files" : "No files uploaded yet"}</p>
          </div>
        ) : (
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="text-left font-medium p-4">File</th>
                  <th className="text-left font-medium p-4 hidden sm:table-cell">Size</th>
                  <th className="text-left font-medium p-4 hidden md:table-cell">Uploaded</th>
                  <th className="text-center font-medium p-4">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((file) => (
                  <tr key={file.id || file.name} className="border-b border-border last:border-0 hover:bg-muted/30">
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        {getIcon(file.name)}
                        <span className="font-medium truncate max-w-[200px] sm:max-w-[300px]">
                          {file.name.replace(/^\d+-/, "")}
                        </span>
                      </div>
                    </td>
                    <td className="p-4 hidden sm:table-cell text-muted-foreground">
                      {file.metadata?.size ? formatSize(file.metadata.size) : "—"}
                    </td>
                    <td className="p-4 hidden md:table-cell text-muted-foreground text-xs">
                      {new Date(file.created_at).toLocaleDateString()}
                    </td>
                    <td className="p-4 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <Button variant="ghost" size="sm" onClick={() => handleDownload(file.name)}>
                          <Download className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => handleDelete(file.name)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
