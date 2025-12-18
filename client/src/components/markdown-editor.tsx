import { useState } from "react";
import MDEditor from "@uiw/react-md-editor";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Save, Eye, Edit } from "lucide-react";

interface MarkdownEditorProps {
  initialContent?: string;
  onSave?: (content: string) => void;
  readOnly?: boolean;
  title?: string;
}

export function MarkdownEditor({
  initialContent = "",
  onSave,
  readOnly = false,
  title = "Markdown Editor"
}: MarkdownEditorProps) {
  const [content, setContent] = useState(initialContent);
  const [isEditing, setIsEditing] = useState(!readOnly);

  const handleSave = () => {
    if (onSave) {
      onSave(content);
    }
  };

  const toggleMode = () => {
    setIsEditing(!isEditing);
  };

  return (
    <Card className="shadow-sm">
      <CardHeader className="border-b border-border">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center space-x-2">
            <span>{title}</span>
          </CardTitle>
          <div className="flex gap-2">
            {!readOnly && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={toggleMode}
                >
                  {isEditing ? (
                    <>
                      <Eye className="w-4 h-4 mr-2" />
                      Preview
                    </>
                  ) : (
                    <>
                      <Edit className="w-4 h-4 mr-2" />
                      Edit
                    </>
                  )}
                </Button>
                {isEditing && onSave && (
                  <Button
                    variant="default"
                    size="sm"
                    onClick={handleSave}
                  >
                    <Save className="w-4 h-4 mr-2" />
                    Salvar
                  </Button>
                )}
              </>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-4">
        <div data-color-mode="light">
          {isEditing ? (
            <MDEditor
              value={content}
              onChange={(val) => setContent(val || "")}
              preview="live"
              height={600}
              visibleDragbar={false}
              highlightEnable={true}
              enableScroll={true}
            />
          ) : (
            <MDEditor.Markdown
              source={content}
              style={{ padding: 16, minHeight: 600 }}
            />
          )}
        </div>
      </CardContent>
    </Card>
  );
}
