import React, { useRef, useState, useContext, useEffect } from "react";
import { Box, Label, Text, Button, Flex } from "theme-ui";
import streamSaver from "streamsaver";
import * as Comlink from "comlink";

import Modal from "../components/Modal";
import LoadingOverlay from "../components/LoadingOverlay";
import LoadingBar from "../components/LoadingBar";

import DatabaseContext from "../contexts/DatabaseContext";

import DatabaseWorker from "worker-loader!../workers/DatabaseWorker"; // eslint-disable-line import/no-webpack-loader-syntax

const worker = Comlink.wrap(new DatabaseWorker());

function ImportDatabaseModal({ isOpen, onRequestClose }) {
  const { database } = useContext(DatabaseContext);
  const [isLoading, setIsLoading] = useState(false);

  const backgroundTaskRunningRef = useRef(false);
  const fileInputRef = useRef();

  function openFileDialog() {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  }

  const loadingProgressRef = useRef(0);

  function handleDBProgress({ completedRows, totalRows }) {
    loadingProgressRef.current = completedRows / totalRows;
  }

  async function handleImportDatabase(file) {
    setIsLoading(true);
    backgroundTaskRunningRef.current = true;
    await database.delete();
    await worker.importData(file, Comlink.proxy(handleDBProgress));
    setIsLoading(false);
    backgroundTaskRunningRef.current = false;
    window.location.reload();
  }

  const fileStreamRef = useRef();

  async function handleExportDatabase() {
    setIsLoading(true);
    backgroundTaskRunningRef.current = true;

    await worker.exportData(Comlink.proxy(handleDBProgress));
    const blob = await worker.data;

    setIsLoading(false);

    const fileStream = streamSaver.createWriteStream(
      `${new Date().toISOString()}.owlbear`,
      {
        size: blob.size,
      }
    );
    fileStreamRef.current = fileStream;

    const readableStream = blob.stream();
    if (window.WritableStream && readableStream.pipeTo) {
      await readableStream.pipeTo(fileStream);
      backgroundTaskRunningRef.current = false;
    } else {
      const writer = fileStream.getWriter();
      const reader = readableStream.getReader();
      async function pump() {
        const res = await reader.read();
        if (res.done) {
          writer.close();
        } else {
          writer.write(res.value).then(pump);
        }
      }
      await pump();
      backgroundTaskRunningRef.current = false;
    }
    fileStreamRef.current = null;
  }

  function handleClose() {
    if (isLoading) {
      return;
    }
    onRequestClose();
  }

  useEffect(() => {
    function handleBeforeUnload(event) {
      if (backgroundTaskRunningRef.current) {
        event.returnValue =
          "Database is still processing, are you sure you want to leave?";
      }
    }

    function handleUnload() {
      if (fileStreamRef.current) {
        fileStreamRef.current.abort();
      }
    }

    window.addEventListener("beforeunload", handleBeforeUnload);
    window.addEventListener("unload", handleUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      window.removeEventListener("unload", handleUnload);
    };
  }, []);

  return (
    <Modal isOpen={isOpen} onRequestClose={handleClose} allowClose={!isLoading}>
      <Flex
        sx={{
          flexDirection: "column",
          justifyContent: "center",
          maxWidth: "300px",
          flexGrow: 1,
        }}
        m={2}
      >
        <Box>
          <Label>Import / Export Database</Label>
          <Text as="p" mb={2} variant="caption">
            Importing a database will overwrite your current data.
          </Text>
          <input
            onChange={(event) => handleImportDatabase(event.target.files[0])}
            type="file"
            accept=".owlbear"
            style={{ display: "none" }}
            ref={fileInputRef}
          />
          <Flex>
            <Button mr={1} sx={{ flexGrow: 1 }} onClick={openFileDialog}>
              Import
            </Button>
            <Button ml={1} sx={{ flexGrow: 1 }} onClick={handleExportDatabase}>
              Export
            </Button>
          </Flex>
        </Box>
        {isLoading && (
          <Box
            sx={{
              width: "100%",
              height: "100%",
              position: "absolute",
              top: 0,
              left: 0,
            }}
          >
            <LoadingOverlay />
            <LoadingBar
              isLoading={isLoading}
              loadingProgressRef={loadingProgressRef}
            />
          </Box>
        )}
      </Flex>
    </Modal>
  );
}

export default ImportDatabaseModal;
