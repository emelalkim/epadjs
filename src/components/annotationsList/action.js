import {
  LOAD_ANNOTATIONS,
  LOAD_ANNOTATIONS_SUCCESS,
  LOAD_ANNOTATIONS_ERROR,
  VIEWPORT_FULL_ERROR,
  UPDATE_ANNOTATION,
  TOGGLE_ALL_ANNOTATIONS
} from "./types";
import { getSeries } from "../../services/seriesServices";
import { getStudies } from "../../services/studyServices";
import {
  getAnnotations,
  getAnnotationsJSON
} from "../../services/annotationServices";
// TODO
// study selection logic will be changed according to remaining available viewport
// test cases 1- select a project check if all series are selected
// test cases 2- select a serie
// in the client check the length of the viewports
// change the active port if user clicks another port

export const loadAnnotations = () => {
  return {
    type: LOAD_ANNOTATIONS
  };
};

export const annotationsLoaded = (summaryData, aimsData, id) => {
  return {
    type: LOAD_ANNOTATIONS_SUCCESS,
    payload: { summaryData, aimsData, id }
  };
};

export const annotationsLoadingError = error => {
  return {
    type: LOAD_ANNOTATIONS_ERROR,
    error
  };
};

export const viewPortFullError = error => {
  return {
    type: VIEWPORT_FULL_ERROR,
    error
  };
};

export const updateAnnotation = (serie, study, annotation, isDisplayed) => {
  return {
    type: UPDATE_ANNOTATION,
    payload: { serie, study, annotation, isDisplayed }
  };
};

export const toggleAllAnnotations = (serieID, studyID, displayStatus) => {
  return {
    type: TOGGLE_ALL_ANNOTATIONS,
    payload: { serieID, studyID, displayStatus }
  };
};

const getAimListFields = aims => {
  const result = {};
  aims.forEach((aim, index) => {
    result[aim.uniqueIdentifier.root] = {
      json: aim,
      isDisplayed: true,
      showLabel: true,
      cornerStoneTools: []
    };
  });
  return result;
};

const getRequiredFields = (arr, type, selectedID) => {
  let result = {};
  if (arr) {
    arr.forEach(element => {
      let obj;
      if (type === "study") {
        const { studyUID, studyDescription } = element;
        obj = { studyUID, studyDescription };
        result[studyUID] = obj;
      } else if (type === "serie") {
        const { seriesUID, seriesDescription, studyUID } = element;
        const isDisplayed = seriesUID === selectedID;
        obj = { seriesUID, seriesDescription, studyUID, isDisplayed };
        result[seriesUID] = obj;
      } else {
        const { seriesUID, name, aimID, comment } = element;
        const isDisplayed = seriesUID === selectedID;
        obj = { seriesUID, name, aimID, comment, isDisplayed };
        result[aimID] = obj;
      }
    });
  }
  return result;
};

const getStudiesData = async (dataObj, projectID, patientID) => {
  try {
    const {
      data: {
        ResultSet: { Result: studies }
      }
    } = await getStudies(projectID, patientID);
    //create an empty object to be "studies" property in the data
    //iterate over the studies array create key/value pairs
    dataObj["studies"] = getRequiredFields(studies, "study");
    return new Promise((resolve, reject) => {
      resolve(dataObj);
    });
  } catch (err) {
    return new Promise((resolve, reject) => {
      reject(
        new Error(
          `Error while getting study data ${err}`,
          "src/components/annotationList/action.js"
        )
      );
    });
  }
};

const getSeriesData = async (projectID, patientID, studyID, selectedID) => {
  try {
    const {
      data: {
        ResultSet: { Result: series }
      }
    } = await getSeries(projectID, patientID, studyID);
    const formattedSeries = getRequiredFields(series, "serie", selectedID);
    return new Promise((resolve, reject) => {
      resolve(formattedSeries);
    });
  } catch (err) {
    return new Promise((resolve, reject) => {
      reject(
        new Error(
          `Error while getting series data ${err}`,
          "src/components/annotationList/action.js"
        )
      );
    });
  }
};

const getAnnotationData = async (
  projectID,
  patientID,
  studyID,
  seriesID,
  selectedID
) => {
  try {
    const {
      data: {
        ResultSet: { Result: annotations }
      }
    } = await getAnnotations(projectID, patientID, studyID, seriesID);
    let formattedAnnotation = [];
    if (annotations) {
      formattedAnnotation = getRequiredFields(
        annotations,
        "annotation",
        selectedID
      );
    }
    return new Promise((resolve, reject) => {
      resolve(formattedAnnotation);
    });
  } catch (err) {
    return new Promise((resolve, reject) => {
      reject(
        new Error(
          `Error while getting annotations data ${err}`,
          "src/components/annotationList/action.js"
        )
      );
    });
  }
};

// gets one patient and all the studys->series->annotations under it
export const getAnnotationListData = (viewport, serie, study) => {
  return async (dispatch, getState) => {
    // create an object with patient details
    dispatch(loadAnnotations());
    const { projectID, patientID, patientName, seriesUID, studyUID } =
      serie || study;
    const selectedID = serie.seriesUID;
    let summaryData = {
      seriesUID,
      projectID,
      patientID,
      patientName,
      studyUID
    };
    let aimsData = {};
    // make call to get study and populate the studies data
    try {
      await getStudiesData(summaryData, projectID, patientID);
    } catch (error) {
      dispatch(annotationsLoadingError(error));
    }
    // make call to get series and populate studies with series data
    const studies = Object.values(summaryData["studies"]);
    studies.forEach(async study => {
      let series;
      try {
        series = await getSeriesData(
          projectID,
          patientID,
          study.studyUID,
          selectedID
        );
        study.series = series;
        //make call to get annotations and populate series annotations data
        const seriesArr = Object.values(study.series);
        seriesArr.forEach(async serie => {
          try {
            const annotations = await getAnnotationData(
              projectID,
              patientID,
              study.studyUID,
              serie.seriesUID,
              selectedID
            );
            serie.annotations = annotations;
          } catch (error) {
            dispatch(annotationsLoadingError(error));
          }
        });
      } catch (error) {
        dispatch(annotationsLoadingError(error));
      }
    });

    try {
      const {
        data: {
          imageAnnotations: { ImageAnnotationCollection: aims }
        }
      } = await getAnnotationsJSON(projectID, patientID, studyUID, seriesUID);
      // console.log("aims", aims);
      aimsData = getAimListFields(aims);
    } catch (err) {
      dispatch(annotationsLoadingError(err));
    }
    dispatch(annotationsLoaded(summaryData, aimsData, seriesUID));
  };
};
