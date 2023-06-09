// page/note/[id].js
import React, {
  useState,
  useEffect,
  useCallback,
  useRef,
  useMemo,
} from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/router";
import Link from "next/link";
import { useAuth, SignInButton } from "@clerk/nextjs";
import { Button, Modal } from "react-bootstrap";
import { ArrowLeft } from "react-bootstrap-icons";
import { getNote, updateNote, uploadImg } from "@/modules/Data";
import styles from "@/styles/editor.module.css";
import Loading from "@/components/Loading"
import {BsCameraFill} from 'react-icons/bs';
// Dynamic import for react-quill to prevent server-side rendering issues
const ReactQuill = dynamic(
  async () => {
    const { default: RQ } = await import("react-quill");

    return ({ forwardedRef, ...props }) => <RQ ref={forwardedRef} {...props} />;
  },
  {
    ssr: false,
  }
);
import Webcam from "react-webcam";
import { IKImage, IKCore, IKContext, IKUpload } from "imagekitio-react";

export default function Editor() {
  // Initialize states for the note title and content
  const [note, setNote] = useState("");
  const [noteTitle, setNoteTitle] = useState("");
  const [noteContent, setNoteContent] = useState("");
  const [updatedTitle, setUpdatedTitle] = useState("");
  const [updatedContent, setUpdatedContent] = useState("");
  // State to track auto-save status
  const [isSaved, setIsSaved] = useState(false);
  // State of showing webcam modal
  const [showWebcamModal, setShowWebcamModal] = useState(false);

  // Use the useRouter hook to programmatically navigate back to the dashboard
  const router = useRouter();
  const { id } = router.query;
  const { isLoaded, userId, sessionId, getToken } = useAuth();
  const [jwt, setJwt] = useState("");
  const [camera, setCamera] = useState(false);
  const webcamRef = useRef(null);
  const quillObj = useRef(false);

  const uploadImgToImageKit = async (file) => {
    const body = {
      file: file,
    };
    const token = await getToken({ template: "codehooks" });

    const result = await uploadImg(token, body);

    return result;
  };

  const videoConstraints = {
    width: 360,
    height: 640,
    facingMode: "environment",
  };

  const convertToBase64 = (file) =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
    });

  const imageHandler = async () => {
    // const reader = new FileReader();

    const input = document.createElement("input");

    input.setAttribute("type", "file");
    input.setAttribute("accept", "image/*");
    input.click();

    input.onchange = async () => {
      const file = await convertToBase64(input.files[0]);
      uploadImgToImageKit(file).then((result) => {
        console.log(result);
        const range = quillObj.current.getEditorSelection();

        quillObj.current
          .getEditor()
          .insertEmbed(range.index, "image", result.url);
      });
    };
  };

  const modules = useMemo(
    () => ({
      toolbar: {
        container: [
          [{ header: [1, 2, false] }],
          ["bold", "italic", "underline", "strike", "blockquote"],
          [
            { list: "ordered" },
            { list: "bullet" },
            { indent: "-1" },
            { indent: "+1" },
          ],
          ["link", "image"],
          ["clean"],
        ],
        handlers: {
          image: imageHandler,
        },
      },
    }),
    []
  );

  const capture = useCallback(
    async (content) => {
      const imageSrc = webcamRef.current.getScreenshot();

      uploadImgToImageKit(imageSrc).then((result) => {
        const html = content + `<img src=${result.url} alt="screenshot" />`;
        // console.log(result.url);
        setNoteContent(html);
        setCamera(false);
      });
    },
    [webcamRef]
  );

  // const deleteImage = async (content, delta, source, editor) => {
  //   // console.log("content: " + content);
  //   // console.log("delta: " + delta);
  //   // console.log("source: " + source);
  //   // const isDeleting = JSON.stringify(delta.ops[1].delete);
  //   // console.log("delta: " + JSON.stringify(delta.ops));
  //   // console.log("-------------------------------------");
  //   // console.log("editor: " + JSON.stringify(editor.getContents()));
  //   // if(isDeleting === "1"){
  //   //   console.log("hey")
  //   //   // const isImage = JSON.stringify(editor.getContents)
  //   //   console.log("editor: " + JSON.stringify(editor.getContents()));
  //   // }
  //   // console.log("editor: " + JSON.stringify(editor.getContents().delete()));
  // };

  // Redirect to home page if user is not signed in
  useEffect(() => {
    if (!isLoaded && !userId) {
      router.push("/");
    }
  }, [userId, isLoaded, router]);

  // Fetch note data
  useEffect(() => {
    async function fetchNote() {
      if (userId && id) {
        const token = await getToken({ template: "codehooks" });
        setJwt(token);
        const fetchedNote = await getNote(token, id);
        setNote(fetchedNote);
        setNoteTitle(fetchedNote.title);
        setNoteContent(fetchedNote.content);
      }
    }
    fetchNote();
  }, [userId, jwt, id]);

  // Auto-save when noteTitle or noteContent change

  useEffect(() => {
    setIsSaved(false);
    const autoSaveDelay = 1000; // Auto-save delay in milliseconds
    const timeoutId = setTimeout(handleAutoSave, autoSaveDelay);
    return () => clearTimeout(timeoutId);
  }, [noteTitle, noteContent]);

  // Update note data
  useEffect(() => {
    if (note) {
      setUpdatedTitle(note.title);
      setUpdatedContent(note.content);
    }
  }, [note]);

  // Function to handle auto-saving
  const handleAutoSave = async () => {
    try {
      const modifiedNote = {
        title: noteTitle,
        content: noteContent,
        category: note.category,
        userId: userId,
      };

      await updateNote(jwt, id, modifiedNote);
      setIsSaved(true);
    } catch (error) {
      console.error("Failed to auto-save note:", error);
    }
  };

  if (!note) {
    // return <div>Loading...</div>;
    return <Loading/>;
  }
  return (
    <div>
      {/* Check if the user is signed in before rendering the content */}
      {userId ? (
        <div className={styles.pageContainer}>
          {/* Webcam Modal */}
          <Modal
            dialogClassName="webcamModal"
            size="lg"
            show={showWebcamModal}
            onHide={() => setShowWebcamModal(false)}
            aria-labelledby="example-modal-sizes-title-lg"
          >
            <Modal.Header closeButton closeVariant="white">
              <Modal.Title id="example-modal-sizes-title-lg">
                
              </Modal.Title>
            </Modal.Header>
            <Modal.Body>
              <div className={styles.webcam}>
                  {(
                    <>
                      <Webcam
                        audio={false}
                        height={400}
                        width={400}
                        ref={webcamRef}
                        screenshotFormat="image/jpeg"
                        mirrored={false}
                        videoConstraints={videoConstraints}
                      />
                      <Button className={styles.webcamButton} onClick={() => capture(noteContent)}>Take Photo</Button>
                    </>
                  )}
                </div>
            </Modal.Body>
          </Modal>
          {/* Top bar */}
          <div className={styles.topBar}>
            {/* Left button: Go back to dashboard */}
            <Button
              variant="outline-light"
              className={styles.backButton}
              // onClick={() => router.push('/dashboard')}
              onClick={() => router.push(`/dashboard`)}
            >
              <ArrowLeft />
            </Button>
            {/* Mid part: Display note title (non-editable) */}
            <div className={styles.pageTitle}>{noteTitle || "Untitled"}</div>
            {/* Right part: Auto-save status */}
            <div className={styles.saveStatus}>
              {isSaved ? "Saved" : "Saving..."}
            </div>
          </div>
          
          
          <div className={styles.editorContainer}>
            <div className={styles.titleContainer}>
              {/* Title input (editable) */}
              <input
                className={styles.noteTitleInput}
                type="text"
                value={noteTitle}
                onChange={(e) => setNoteTitle(e.target.value)}
                placeholder="Note Title"
              />
              {/* Camera button */}
              <button className={styles.cameraButton} onClick={() => setShowWebcamModal(true)}>
                <BsCameraFill/>
              </button> 
            </div>
            {/* Note Editor */}
            <ReactQuill
              forwardedRef={quillObj}
              className={styles.noteEditor}
              value={noteContent}
              onChange={(content, delta, source, editor) => {
                setNoteContent(content);
              }}
              modules={modules}
              placeholder="Start writing your note..."
            />
          </div>
        </div>
      ) : (
        <div className="text-center mt-5">
          <Alert variant="info">
            Please log in to access your Todo List.
            <SignInButton mode="modal">
              <Button className="btn">Sign in</Button>
            </SignInButton>
          </Alert>
        </div>
      )}
    </div>
  );
}
