import React, { Component } from "react";
import cornerstone from "cornerstone-core";
import cornerstoneTools from "cornerstone-tools";
import {
  getImageIds,
  getWadoImagePath,
  getSegmentation,
} from "../../services/seriesServices";
import { connect } from "react-redux";
import { Redirect } from "react-router";
import { withRouter } from "react-router-dom";
import "./flex.css";
import "./viewport.css";
import {
  changeActivePort,
  updateImageId,
  clearActivePortAimID,
  closeSerie,
  jumpToAim,
  setSegLabelMapIndex,
} from "../annotationsList/action";
import ContextMenu from "./contextMenu";
import { MenuProvider } from "react-contexify";
import CornerstoneViewport from "react-cornerstone-viewport";
import { freehand } from "./Freehand";
import { line } from "./Line";
import { probe } from "./Probe";
import { circle } from "./Circle";
import { bidirectional } from "./Bidirectional";
import RightsideBar from "../RightsideBar/RightsideBar";
import * as dcmjs from "dcmjs";
import { FaTimes, FaPen, FaExpandArrowsAlt } from "react-icons/fa";
import Form from "react-bootstrap/Form";
import ToolMenu from "../ToolMenu/ToolMenu";

const mode = sessionStorage.getItem("mode");
const wadoUrl = sessionStorage.getItem("wadoUrl");

const tools = [
  { name: "Wwwc", modeOptions: { mouseButtonMasks: 1 }, mode: "active" },
  { name: "Pan", modeOptions: { mouseButtonMasks: 1 } },
  {
    name: "Zoom",
    configuration: {
      minScale: 0.3,
      maxScale: 25,
      preventZoomOutsideImage: true,
    },
    modeOptions: { mouseButtonMasks: [1, 2] },
  },
  { name: "Probe", modeOptions: { mouseButtonMasks: 1 }, mode: "passive" },
  { name: "Length", modeOptions: { mouseButtonMasks: 1 }, mode: "passive" },
  // {
  //   name: "EllipticalRoi",
  //   configuration: {
  //     showMinMax: true
  //   }
  // },
  // {
  //   name: "RectangleRoi",
  //   configuration: {
  //     showMinMax: true
  //   }
  // },
  {
    name: "CircleRoi",
    configuration: {
      showMinMax: true,
    },
    modeOptions: { mouseButtonMask: 1 },
    mode: "passive",
  },
  { name: "Angle" },
  { name: "Rotate" },
  { name: "WwwcRegion" },
  {
    name: "FreehandRoi",
    modeOptions: { mouseButtonMask: [1] },
    mode: "passive",
  },
  { name: "FreehandRoiSculptor", modeOptions: { mouseButtonMask: 1 } },
  {
    name: "FreehandRoi3DTool",
    modeOptions: { mouseButtonMask: 1 },
    mode: "passive",
  },
  {
    name: "FreehandRoi3DSculptorTool",
    modeOptions: { mouseButtonMask: 1 },
    mode: "passive",
  },
  { name: "Eraser" },
  {
    name: "Bidirectional",
    modeOptions: { mouseButtonMask: 1 },
    mode: "passive",
  },
  { name: "Brush3DTool" },
  { name: "StackScroll", modeOptions: { mouseButtonMask: 1 } },
  { name: "PanMultiTouch" },
  { name: "ZoomTouchPinch" },
  { name: "StackScrollMouseWheel", mode: "active" },
  { name: "StackScrollMultiTouch" },
  { name: "FreehandScissors", modeOptions: { mouseButtonMask: 1 } },
  { name: "RectangleScissors", modeOptions: { mouseButtonMask: 1 } },
  { name: "CircleScissors", modeOptions: { mouseButtonMask: 1 } },
  { name: "CorrectionScissors", modeOptions: { mouseButtonMask: 1 } },
];

const mapStateToProps = (state) => {
  return {
    series: state.annotationsListReducer.openSeries,
    loading: state.annotationsListReducer.loading,
    activePort: state.annotationsListReducer.activePort,
    aimList: state.annotationsListReducer.aimsList,
    aimSegLabelMaps: state.annotationsListReducer.aimSegLabelMaps,
  };
};

class DisplayView extends Component {
  constructor(props) {
    super(props);
    this.state = {
      width: "100%",
      height: "100%",
      hiding: false,
      data: [],
      isLoading: true,
      selectedAim: undefined,
      dirty: false,
      refs: props.refs,
      showAnnDetails: true,
      hasSegmentation: false,
      activeLabelMapIndex: 0,
      aimLabelMaps: {},
      redirect: this.props.series.length < 1 ? true : false,
    };
  }

  componentDidMount() {
    const { pid } = this.props;
    if (this.props.series.length < 1) {
      if (pid) this.props.history.push(`/search/${pid}`);
      else return;
    }
    this.getViewports();
    this.getData();
    window.addEventListener("markupSelected", this.handleMarkupSelected);
    window.addEventListener("markupCreated", this.handleMarkupCreated);
    window.addEventListener("toggleAnnotations", this.toggleAnnotations);
    window.addEventListener("jumpToAimImage", this.jumpToAimImage);
  }

  async componentDidUpdate(prevProps) {
    const { pid, series, activePort, aimList } = this.props;
    const {
      series: prevSeries,
      activePort: prevActivePort,
      aimList: prevAimList,
    } = prevProps;
    const activeSerie = series[activePort];
    const prevActiveSerie = prevSeries[prevActivePort];

    if (this.props.series.length < 1) {
      if (pid) this.props.history.push(`/search/${pid}`);
      else return;
      return;
    }
    if (
      (prevProps.series !== this.props.series &&
        prevProps.loading === true &&
        this.props.loading === false) ||
      (prevProps.series.length !== this.props.series.length &&
        this.props.loading === false)
    ) {
      await this.setState({ isLoading: true });
      this.getViewports();
      this.getData();
    }
    // This is to handle late loading of aimsList from store but it also calls getData
    // each time visibility of aims change
    else if (Object.keys(aimList).length !== Object.keys(prevAimList).length) {
      console.log("Aim lists are not equal", aimList, prevAimList);
      // this.getData();
      this.renderAims();
    }
  }

  componentWillUnmount() {
    window.removeEventListener("markupSelected", this.handleMarkupSelected);
    window.removeEventListener("markupCreated", this.handleMarkupCreated);
    window.removeEventListener("toggleAnnotations", this.toggleAnnotations);
    window.removeEventListener("jumpToAimImage", this.jumpToAimImage);
  }

  toggleAnnotations = (event) => {
    const { aimID, isVisible } = event.detail;
    const { activePort } = this.props;
    const { element } = cornerstone.getEnabledElements()[activePort];

    this.setVisibilityOfSegmentations(aimID, element, isVisible);
    this.setVisibilityOfShapes(isVisible, aimID);

    cornerstone.updateImage(element);
  };

  // Traverse all shapes and set visibility, if aimID is passed only sets aim's shapes
  setVisibilityOfShapes = (visibility, aimID) => {
    const { series, activePort } = this.props;
    const { seriesUID } = series[activePort];
    const shapesOfSerie = this.getShapesOfSerie(seriesUID);
    shapesOfSerie.forEach((shape) => {
      if (aimID && shape.aimId === aimID) shape.visible = visibility;
      else if (!aimID) {
        shape.visible = visibility;
      }
    });
  };

  getShapesOfSerie = (seriesUID) => {
    const { aimList } = this.props;
    const seriesAims = aimList[seriesUID];
    const toolState = cornerstoneTools.globalImageIdSpecificToolStateManager.saveToolState();
    const shapes = [];
    Object.values(toolState).forEach((imageState) => {
      Object.values(imageState).forEach((tools) => {
        Object.values(tools).forEach((tool) => {
          tool.forEach((shape) => {
            if (
              typeof shape.aimId === "undefined" ||
              typeof seriesAims[shape.aimId] !== "undefined"
            )
              shapes.push(shape);
          });
        });
      });
    });
    return shapes;
  };

  setVisibilityOfSegmentations = (aimID, element, setVisibilityTo) => {
    const { series, activePort, aimSegLabelMaps } = this.props;
    console.log("aimID, aimSegLabelMaps", aimID, aimSegLabelMaps);
    const { seriesUID } = series[activePort];
    const { setters, getters } = cornerstoneTools.getModule("segmentation");
    if (aimID) {
      const labelMapIndex = aimSegLabelMaps[aimID];
      setters.toggleSegmentVisibility(element, 1, labelMapIndex);
      const visibility = getters.isSegmentVisible(element, 1, labelMapIndex);
      if (visibility === setVisibilityTo) return;
    } else {
      const seriesLabelMapIndexes = this.getLabelMapsOfSerie(seriesUID);
      seriesLabelMapIndexes.forEach((labelMapIndex) => {
        const visibility = getters.isSegmentVisible(element, 1, labelMapIndex);
        if (visibility === setVisibilityTo) return;
        setters.toggleSegmentVisibility(element, 1, labelMapIndex);
      });
    }
  };

  getLabelMapsOfSerie = (seriesUID) => {
    const segAims = this.getSegmentationAimsOfSerie(seriesUID);
    const { aimSegLabelMaps } = this.props;
    return segAims.map((aimId) => {
      if (typeof aimSegLabelMaps[aimId] !== "undefined")
        return aimSegLabelMaps[aimId];
    });
  };

  getSegmentationAimsOfSerie = (seriesUID) => {
    const { aimList } = this.props;
    const seriesAims = aimList[seriesUID];
    const segAims = [];
    Object.entries(seriesAims).forEach(([key, value]) => {
      if (value.json.segmentationEntityCollection) {
        segAims.push(key);
      }
    });
    return segAims;
  };

  // getMarkups = (aimOfInterest) => {
  //   const toolState = cornerstoneTools.globalImageIdSpecificToolStateManager.saveToolState();
  //   var markupsToReturn = {};
  //   Object.keys(toolState).forEach((key) => {
  //     const markUps = toolState[key];
  //     Object.keys(markUps).map((tool) => {
  //       switch (tool) {
  //         case "FreehandRoi3DTool":
  //         case "FreehandRoi":
  //           const polygons3d = markUps[tool].data;
  //           polygons3d.map((polygon) => {
  //             if (!polygon.aimId || polygon.aimId === aimOfInterest)
  //               markupsToReturn["Polygon"] = { validate: "" };
  //           });
  //           break;
  //         case "Bidirectional":
  //           const bidirectionals = markUps[tool].data;
  //           bidirectionals.map((bidirectional) => {
  //             if (!bidirectional.aimId || bidirectional.aimId === aimOfInterest)
  //               markupsToReturn["Perpendicular"] = { validate: "" };
  //           });
  //           break;
  //         case "CircleRoi":
  //           const circles = markUps[tool].data;
  //           circles.map((circle) => {
  //             if (!circle.aimId || circle.aimId === aimOfInterest)
  //               markupsToReturn["Circle"] = { validate: "" };
  //           });
  //           break;
  //         case "Length":
  //           const lines = markUps[tool].data;
  //           lines.map((line) => {
  //             if (!line.aimId || line.aimId === aimOfInterest)
  //               markupsToReturn["Line"] = { validate: "" };
  //           });
  //           break;
  //         case "Probe":
  //           const points = markUps[tool].data;
  //           points.map((point) => {
  //             if (!point.aimId || point.aimId === aimOfInterest)
  //               markupsToReturn["Point"] = { validate: "" };
  //           });
  //           break;
  //       }
  //     });
  //   });
  //   return markupsToReturn;
  // };

  getData() {
    console.log("Getting data", this.props);
    // clear the toolState they will be rendered again on next load
    const toolState = cornerstoneTools.globalImageIdSpecificToolStateManager.saveToolState();

    cornerstoneTools.globalImageIdSpecificToolStateManager.restoreToolState({});
    // clear the segmentation data as well
    cornerstoneTools.store.modules.segmentation.state.series = {};

    const { series } = this.props;
    var promises = [];
    for (let i = 0; i < series.length; i++) {
      const promise = this.getImageStack(series[i], i);
      promises.push(promise);
    }
    Promise.all(promises).then((res) => {
      this.setState({
        data: res,
        isLoading: false,
        activeLabelMapIndex: 0,
        prospectiveLabelMapIndex: 0,
      });

      this.renderAims();

      this.refreshAllViewports();
      // this.props.dispatch(clearActivePortAimID());
    });
  }

  renderAims = (notShowAimEditor = false) => {
    const { series } = this.props;
    this.setState({
      activeLabelMapIndex: 0,
      prospectiveLabelMapIndex: 0,
    });
    // clear the toolState they will be rendered again on next load
    cornerstoneTools.globalImageIdSpecificToolStateManager.restoreToolState({});
    // clear the segmentation data as well
    cornerstoneTools.store.modules.segmentation.state.series = {};
    series.forEach((serie, serieIndex) => {
      console.log("seri iamge annotations", serie);
      if (serie.aimID && !notShowAimEditor) {
        console.log("sernin aimID si mi var", serie);
        this.openAimEditor(serie);
      }
      if (serie.imageAnnotations)
        this.parseAims(
          serie.imageAnnotations,
          serie.seriesUID,
          serie.studyUID,
          serieIndex,
          serie
        );
    });
  };

  async getImages(serie) {
    const { data: urls } = await getImageIds(serie); //get the Wado image ids for this series
    return urls;
  }

  prepUrl = (url) => {
    return `wadors:http://localhost:8090/pacs/studies/${url.studyUID}/series/${url.seriesUID}/instances/${url.imageUID}`;
  };

  getImageFrameURI = (metadataURI, metadata) => {
    // Use the BulkDataURI if present int the metadata
    // if (metadata["7FE00010"] && metadata["7FE00010"].BulkDataURI) {
    //   console.log("donuyom", metadata["7FE00010"].BulkDataURI);
    //   return metadata["7FE00010"].BulkDataURI;
    // }

    // fall back to using frame #1
    return metadataURI + "/frames/1";
  };
  getImageStack = async (serie, index) => {
    let stack = {};
    let newImageIds = {};
    let cornerstoneImageIds = [];
    const imageUrls = await this.getImages(serie);
    imageUrls.map((url) => {
      const baseUrl = wadoUrl + url.lossyImage;
      if (url.multiFrameImage === true) {
        for (var i = 0; i < url.numberOfFrames; i++) {
          let multiFrameUrl = baseUrl + "&frame=" + i;
          // mode !== "lite" ? baseUrl + "/frames/" + i : baseUrl;
          cornerstoneImageIds.push(multiFrameUrl);
          cornerstone.loadAndCacheImage(multiFrameUrl);
          newImageIds[multiFrameUrl] = true;
        }
      } else {
        let singleFrameUrl = baseUrl;
        cornerstoneImageIds.push(singleFrameUrl);
        cornerstone.loadAndCacheImage(singleFrameUrl);
        newImageIds[singleFrameUrl] = false;
      }
      // } else {
      //   let singleFrameUrl = baseUrl;
      //   console.log("Single frame url", singleFrameUrl);
      //   cornerstoneImageIds.push(singleFrameUrl);
      //   imageIds[singleFrameUrl] = false;
      //   const { data } = await getMetadata(singleFrameUrl);
      //   console.log("Metadata", data);
      //   const metadata = data[0];
      //   const imageFrameURI = this.getImageFrameURI(
      //     singleFrameUrl + "/metadata",
      //     metadata
      //   );
      //   const imageId = "wadors:" + imageFrameURI;

      //   cornerstoneWADOImageLoader.wadors.metaDataManager.add(
      //     imageId,
      //     metadata
      //   );
      //   cornerstone.loadAndCacheImage(imageId);
      // }
    });
    const { imageIds } = this.state;
    this.setState({ imageIds: { ...imageIds, ...newImageIds } });

    //to jump to the same image after aim save
    let imageIndex;
    if (
      this.state.data[index] &&
      this.state.data[index].stack.currentImageIdIndex
    )
      imageIndex = this.state.data[index].stack.currentImageIdIndex;
    else imageIndex = 0;

    // if serie is being open from the annotation jump to that image and load the aim editor
    if (serie.aimID) {
      imageIndex = this.getImageIndex(serie, cornerstoneImageIds);
    }

    stack.currentImageIdIndex = parseInt(imageIndex, 10);
    stack.imageIds = [...cornerstoneImageIds];
    return { stack };
  };

  openAimEditor = (serie) => {
    const { aimList } = this.props;
    const { aimID, seriesUID } = serie;
    if (Object.entries(aimList).length !== 0) {
      const aimJson = aimList[seriesUID][aimID].json;
      aimJson.aimID = aimID;
      const markupTypes = this.getMarkupTypesForAim(aimID);
      aimJson["markupType"] = [...markupTypes];
      aimJson["aimId"] = aimID;
      if (this.hasSegmentation(aimJson))
        this.setState({ hasSegmentation: true });
      if (this.state.showAimEditor && this.state.selectedAim !== aimJson)
        this.setState({ showAimEditor: false });
      this.setState({ showAimEditor: true, selectedAim: aimJson });
    }
  };

  setActiveLabelMapOfAim = (aimJson, element) => {
    // Means aim has segmentation alreay, find its segment index and set to edit it
    const { aimID } = aimJson;
    const labelMapOfAim = this.state.aimLabelMaps[aimID];
    this.setActiveLabelMapIndex(labelMapOfAim, element);
  };

  setActiveLabelMapIndex = (index, element) => {
    const { setters } = cornerstoneTools.getModule("segmentation");
    // const element = this.getActiveElement();
    setters.activeLabelmapIndex(element, index);
  };

  getActiveElement = () => {
    const { activePort } = this.props;
    const { element } = cornerstone.getEnabledElements()[activePort] || {};
    return element;
  };

  hasSegmentation = (aimJson) => {
    const { markupType } = aimJson;
    if (Array.isArray(markupType) && markupType.length)
      return markupType.some(this.isDicomSegEntity);
  };

  isDicomSegEntity = (markupType) => {
    return markupType === "DicomSegmentationEntity";
  };

  getImageIndex = (serie, cornerstoneImageIds) => {
    let { aimID, imageAnnotations, studyUID, seriesUID } = serie;
    if (imageAnnotations) {
      for (let [key, values] of Object.entries(imageAnnotations)) {
        for (let value of values) {
          if (value.aimUid === aimID) {
            const cornerstoneImageId = getWadoImagePath(
              studyUID,
              seriesUID,
              key
            );
            const ret = this.getImageIndexFromImageId(
              cornerstoneImageIds,
              cornerstoneImageId
            );
            return ret;
          }
        }
      }
    }
    return 0;
  };

  getImageIndexFromImageId = (cornerstoneImageIds, cornerstoneImageId) => {
    const { imageIds } = this.state;
    if (!imageIds[cornerstoneImageId])
      cornerstoneImageId = cornerstoneImageId.split("&frame")[0];
    for (let [key, value] of Object.entries(cornerstoneImageIds)) {
      if (value == cornerstoneImageId) return key;
    }
    return 0;
  };

  getViewports = () => {
    let numSeries = this.props.series.length;
    let numCols = numSeries % 3;
    if (numSeries > 3) {
      this.setState({ height: "calc((100% / 2)" });
      this.setState({ width: "33%" });
      return;
    }
    if (numCols === 1) {
      this.setState({ width: "100%" });
    } else if (numCols === 2) this.setState({ width: "50%" });
    else this.setState({ width: "33%", height: "100%" });
  };

  createRefs() {
    this.state.series.map(() =>
      this.props.dispatch(this.createViewport(React.createRef()))
    );
  }

  createViewport(viewportRef) {
    return {
      type: "CREATE_VIEWPORT",
      payload: viewportRef,
    };
  }

  defaultSelectVP(id) {
    return {
      type: "SELECT_VIEWPORT",
      payload: id,
    };
  }

  hideShow = (current) => {
    if (this.props.activePort !== i) {
      this.setActive(i);
      return;
    }
    if (this.state.hideShowDisabled) {
      // this.setState({ hideShowDisabled: false });
      return;
    }
    // const element = cornerstone.getEnabledElements()[practivePort];
    const elements = document.getElementsByClassName("viewportContainer");
    if (this.state.hiding === false) {
      for (var i = 0; i < elements.length; i++) {
        if (i != current) elements[i].style.display = "none";
      }
      this.setState({ height: "100%", width: "100%" });
    } else {
      this.getViewports();
      for (var i = 0; i < elements.length; i++) {
        elements[i].style.display = "inline-block";
      }
    }
    this.setState({ hiding: !this.state.hiding }, () =>
      window.dispatchEvent(new Event("resize"))
    );
  };

  getShapes = () => {
    const { series, activePort } = this.props;
    const aimId = series[activePort].aimID || undefined;
    return this.getMarkups(aimId);
  };

  getMarkups = (aimOfInterest) => {
    const toolState = cornerstoneTools.globalImageIdSpecificToolStateManager.saveToolState();
    var markupsToReturn = {};
    Object.keys(toolState).forEach((key) => {
      const markUps = toolState[key];
      Object.keys(markUps).map((tool) => {
        switch (tool) {
          case "FreehandRoi3DTool":
          case "FreehandRoi":
            const polygons3d = markUps[tool].data;
            polygons3d.map((polygon) => {
              if (!polygon.aimId || polygon.aimId === aimOfInterest)
                markupsToReturn["Polygon"] = { validate: "" };
            });
            break;
          case "Bidirectional":
            const bidirectionals = markUps[tool].data;
            bidirectionals.map((bidirectional) => {
              if (!bidirectional.aimId || bidirectional.aimId === aimOfInterest)
                markupsToReturn["Perpendicular"] = { validate: "" };
            });
            break;
          case "CircleRoi":
            const circles = markUps[tool].data;
            circles.map((circle) => {
              if (!circle.aimId || circle.aimId === aimOfInterest)
                markupsToReturn["Circle"] = { validate: "" };
            });
            break;
          case "Length":
            const lines = markUps[tool].data;
            lines.map((line) => {
              if (!line.aimId || line.aimId === aimOfInterest)
                markupsToReturn["Line"] = { validate: "" };
            });
            break;
          case "Probe":
            const points = markUps[tool].data;
            points.map((point) => {
              if (!point.aimId || point.aimId === aimOfInterest)
                markupsToReturn["Point"] = { validate: "" };
            });
            break;
        }
      });
    });
    return markupsToReturn;
  };

  // TODO: Can this be done without checking the tools of interest?
  measurementCompleted = (event, action) => {
    const { toolName, toolType } = event.detail;

    const toolsOfInterest = [
      "Probe",
      "Length",
      "CircleRoi",
      "FreehandRoi3DTool",
    ];
    if (toolsOfInterest.includes(toolName) || toolType === "Bidirectional") {
      this.setState({ showAimEditor: true });
      if (toolName === "FreehandRoi3DTool")
        this.setState({ hideShowDisabled: true });
    }
    this.handleShapes();
    this.setDirtyFlag();
  };

  measurementRemoved = (event, action) => {
    this.handleShapes();
    this.setDirtyFlag();
  };

  measuremementModified = (event, action) => {
    this.setDirtyFlag();
  };

  handleShapes = () => {
    const shapes = this.getShapes();
    window.dispatchEvent(
      new CustomEvent("checkShapes", {
        detail: shapes,
      })
    );
  };

  setDirtyFlag = () => {
    if (!this.state.dirty) this.setState({ dirty: true });
  };

  handleMarkupSelected = (event) => {
    const { aimList, series, activePort } = this.props;
    const { seriesUID } = series[activePort];
    const { aimId, ancestorEvent } = event.detail;
    const { element, data } = ancestorEvent;

    if (aimList[seriesUID][aimId]) {
      const aimJson = aimList[seriesUID][aimId].json;
      const markupTypes = this.getMarkupTypesForAim(aimId);
      aimJson["markupType"] = [...markupTypes];
      aimJson["aimId"] = aimId;

      // if we are clciking on an markup and it's aim has segmentation, set the activeLabelMapIndex accordingly
      if (this.hasSegmentation(aimJson)) this.setActiveLabelMapOfAim(aimJson);

      // check if is already editing an aim
      if (this.state.showAimEditor && this.state.selectedAim !== aimJson) {
        let message = "";
        if (this.state.selectedAim) {
          message = this.prepWarningMessage(
            this.state.selectedAim.name.value,
            aimJson.name.value
          );
        }
        // event.detail.ancestorEvent.preventDefault();
        const shouldContinue = this.closeAimEditor(true, message);
        if (!shouldContinue) {
          event.preventDefault();
          data.active = false;
          cornerstone.updateImage(element);
          return;
        }
      }

      //The following dispatched is a wrongly named method. It's dispatched to set the selected
      //AimId in the store!!!!!
      this.props.dispatch(jumpToAim(seriesUID, aimId, activePort));

      this.setState({ showAimEditor: true, selectedAim: aimJson });
    }
  };

  prepWarningMessage = (currentAim, destinationAim) => {
    return `You are trying to edit Aim named: ${destinationAim}. All unsaved changes in Aim named: ${currentAim} will be lost!!!`;
  };

  handleMarkupCreated = (event) => {
    const { detail } = event;
    const { hasSegmentation } = this.state;

    if (!hasSegmentation && detail === "brush") {
      this.setState({ hasSegmentation: true });
    }
    this.setState({ showAimEditor: true, selectedAim: undefined });
  };

  setActive = (i) => {
    if (this.props.activePort !== i) {
      if (this.state.showAimEditor) {
        if (!this.closeAimEditor(true)) {
          //means going to another viewport in the middle of creating/editing an aim
          return;
        }
      }
      this.setState({ activePort: i });
      this.props.dispatch(changeActivePort(i));
    }
  };

  parseAims = (aimList, seriesUid, studyUid, serieIndex, serie) => {
    Object.entries(aimList).forEach(([key, values], aimIndex) => {
      this.linesToPerpendicular(values); //change the perendicular lines to bidirectional to render by CS
      values.forEach((value) => {
        const { markupType, aimUid } = value;
        if (markupType === "DicomSegmentationEntity") {
          console.log(
            "getting segmentation of series, study, aim, aimIndex, serieIndex",
            seriesUid,
            studyUid,
            aimUid,
            aimIndex,
            serieIndex
          );
          this.getSegmentationData(
            seriesUid,
            studyUid,
            aimUid,
            aimIndex,
            serieIndex
          );
        }
        const color = this.getColorOfMarkup(value.aimUid, seriesUid);

        let imageId = getWadoImagePath(studyUid, seriesUid, key);

        if (!this.state.imageIds[imageId])
          //image is not multiframe so strip the frame number from the imageId
          imageId = imageId.split("&frame=")[0];

        this.renderMarkup(imageId, value, color);
        this.refreshAllViewports();
        // if (aimUid === serie.aimID) this.props.dispatch(clearActivePortAimID()); //this data is rendered so clear the aim Id in props
      });
    });
  };

  linesToPerpendicular = (values) => {
    // Takes two lines on the same image, checks if they belong to same Aima and if they are perpendicular.
    // If so, merges two lines on line1, cnahges the markup type from line to perpendicular
    // And deletes the second line not to be reRendered as line agai
    const lines = values.filter(this.checkIfLine);

    const groupedLines = Object.values(this.groupBy(lines, "aimUid"));
    groupedLines.forEach((lines) => {
      if (lines.length > 1) {
        for (let i = 0; i < lines.length; i++) {
          for (let j = i + 1; j < lines.length; j++) {
            let pair = [lines[i], lines[j]];
            if (this.checkIfPerpendicular(pair) && this.intersects(pair)) {
              // there are multiple lines on the same image that belongs to same aim, a potential perpendicular
              // they are perpendicular, remove them from the values list and render them as perpendicular
              pair[0].markupType = "Bidirectional";
              pair[0].calculations = pair[0].calculations.concat(
                pair[1].calculations
              );
              pair[0].coordinates = pair[0].coordinates.concat(
                pair[1].coordinates
              );

              const index = values.indexOf(pair[1]);
              if (index > -1) {
                values.splice(index, 1);
              }
            }
          }
        }
      }
    });
  };

  checkIfPerpendicular = (lines) => {
    const slope1 = this.getSlopeOfLine(
      lines[0]["coordinates"][0],
      lines[0]["coordinates"][1]
    );
    const slope2 = this.getSlopeOfLine(
      lines[1]["coordinates"][0],
      lines[1]["coordinates"][1]
    );

    if (
      (slope1 === "infinity" && slope2 === 0) ||
      (slope1 === 0 && slope2 === "infinity")
    )
      return true;
    else if (Math.round((slope1 * slope2 * 100) / 100) == -1) return true;
    return false;
  };

  getSlopeOfLine = (p1, p2) => {
    if (p2.x.value - p1.x.value === 0) return "infinity";
    return (p1.y.value - p2.y.value) / (p1.x.value - p2.x.value);
  };

  checkIfLine = (markup) => {
    if (markup) {
      return markup.markupType === "TwoDimensionMultiPoint";
    }
  };

  // returns true iff the line from (a,b)->(c,d) intersects with (p,q)->(r,s)
  intersects = (lines) => {
    const a = lines[0]["coordinates"][0].x.value;
    const b = lines[0]["coordinates"][0].y.value;
    const c = lines[0]["coordinates"][1].x.value;
    const d = lines[0]["coordinates"][1].y.value;
    const p = lines[1]["coordinates"][0].x.value;
    const q = lines[1]["coordinates"][0].y.value;
    const r = lines[1]["coordinates"][1].x.value;
    const s = lines[1]["coordinates"][1].y.value;
    var det, gamma, lambda;

    det = (c - a) * (s - q) - (r - p) * (d - b);
    if (det === 0) {
      return false;
    } else {
      lambda = ((s - q) * (r - a) + (p - r) * (s - b)) / det;
      gamma = ((b - d) * (r - a) + (c - a) * (s - b)) / det;
      return 0 < lambda && lambda < 1 && 0 < gamma && gamma < 1;
    }
  };

  groupBy = (xs, key) => {
    return xs.reduce(function (rv, x) {
      (rv[x[key]] = rv[x[key]] || []).push(x);
      return rv;
    }, {});
  };

  getSegmentationData = (seriesUID, studyUID, aimId, aimIndex, serieIndex) => {
    const { aimList } = this.props;

    const segmentationEntity =
      aimList[seriesUID][aimId].json.segmentationEntityCollection
        .SegmentationEntity[0];

    const { seriesInstanceUid, sopInstanceUid } = segmentationEntity;

    const pathVariables = { studyUID, seriesUID: seriesInstanceUid.root };

    getSegmentation(pathVariables, sopInstanceUid.root).then(({ data }) => {
      this.renderSegmentation(data, aimId, serieIndex);
    });
  };

  sleep = (ms) => {
    return new Promise((resolve) => setTimeout(resolve, ms));
  };

  renderSegmentation = (arrayBuffer, aimId, serieIndex) => {
    try {
      const { imageIds } = this.state.data[serieIndex].stack;

      var imagePromises = imageIds.map((imageId) => {
        return cornerstone.loadAndCacheImage(imageId);
      });

      Promise.all(imagePromises).then(() => {
        // const stackToolState = cornerstoneTools.getToolState(element, "stack");

        // const imageIds = stackToolState.data[0].imageIds;
        const {
          labelmapBuffer,
          segMetadata,
          segmentsOnFrame,
        } = dcmjs.adapters.Cornerstone.Segmentation.generateToolState(
          imageIds,
          arrayBuffer,
          cornerstone.metaData
        );

        const { setters } = cornerstoneTools.getModule("segmentation");
        const { activeLabelMapIndex, aimLabelMaps } = this.state;
        this.setState({
          activeLabelMapIndex: activeLabelMapIndex + 1,
          aimLabelMaps: { ...aimLabelMaps, [aimId]: activeLabelMapIndex },
        }); //set the index state for next render

        setters.labelmap3DByFirstImageId(
          imageIds[0],
          labelmapBuffer,
          activeLabelMapIndex,
          segMetadata.data,
          imageIds.length,
          segmentsOnFrame
        );
        console.log(
          "I have rendered ",
          aimId,
          "with labelMapIndex :",
          activeLabelMapIndex
        );

        const { element } = cornerstone.getEnabledElements()[serieIndex];
        if (this.state.selectedAim) {
          //if an aim is selected find its label map index, 0 if no segmentation in aim
          //an aim is being edited don't set the label map index because aim's segs should be brushed
          this.setActiveLabelMapOfAim(this.state.selectedAim, element);
        } else {
          this.setActiveLabelMapIndex(this.state.activeLabelMapIndex, element);
        }
        console.log(
          "dipsatching, aimId, activeLabelMapIndex",
          aimId,
          activeLabelMapIndex
        );
        this.props.dispatch(setSegLabelMapIndex(aimId, activeLabelMapIndex));

        this.refreshAllViewports();
      });
    } catch (error) {
      console.error(error);
    }
  };

  refreshAllViewports = () => {
    const elements = cornerstone.getEnabledElements();
    if (elements) {
      elements.map(({ element }) => {
        try {
          cornerstone.updateImage(element); //update the image to show newly loaded segmentations}
        } catch (error) {
          console.warn("Error:", error);
        }
      });
    }
  };

  getColorOfMarkup = (aimUid, seriesUid) => {
    try {
      return this.props.aimList[seriesUid][aimUid].color.button.background;
    } catch (error) {
      console.error(error);
    }
  };

  renderMarkup = (imageId, markup, color, seriesUid, studyUid) => {
    const type = markup.markupType;
    switch (type) {
      case "TwoDimensionPolyline":
        this.renderPolygon(imageId, markup, color, seriesUid, studyUid);
        break;
      case "TwoDimensionMultiPoint":
        this.renderLine(imageId, markup, color, seriesUid, studyUid);
        break;
      case "TwoDimensionCircle":
        this.renderCircle(imageId, markup, color, seriesUid, studyUid);
        break;
      case "TwoDimensionPoint":
        this.renderPoint(imageId, markup, color, seriesUid, studyUid);
        break;
      case "Bidirectional":
        this.renderBidirectional(imageId, markup, color, seriesUid, studyUid);
        break;
      default:
        return;
    }
  };

  checkNCreateToolForImage = (toolState, imageId, tool) => {
    if (!toolState.hasOwnProperty(imageId))
      toolState[imageId] = { [tool]: { data: [] } };
    else if (!toolState[imageId].hasOwnProperty(tool))
      toolState[imageId] = { ...toolState[imageId], [tool]: { data: [] } };
  };

  renderBidirectional = (imageId, markup, color) => {
    const data = JSON.parse(JSON.stringify(bidirectional));
    data.color = color;
    data.aimId = markup.aimUid;
    data.invalidated = true;
    this.createBidirectionalPoints(data, markup.coordinates);
    const currentState = cornerstoneTools.globalImageIdSpecificToolStateManager.saveToolState();
    this.checkNCreateToolForImage(currentState, imageId, "Bidirectional");
    currentState[imageId]["Bidirectional"].data.push(data);
    cornerstoneTools.globalImageIdSpecificToolStateManager.restoreToolState(
      currentState
    );
  };

  createBidirectionalPoints = (data, points) => {
    data.handles.start.x = points[0].x.value;
    data.handles.start.y = points[0].y.value;
    data.handles.end.x = points[1].x.value;
    data.handles.end.y = points[1].y.value;
    data.handles.perpendicularStart.x = points[2].x.value;
    data.handles.perpendicularStart.y = points[2].y.value;
    data.handles.perpendicularEnd.x = points[3].x.value;
    data.handles.perpendicularEnd.y = points[3].y.value;
    // need to set the text box coordinates for this too
    data.handles.textBox.x = points[0].x.value;
    data.handles.textBox.y = points[0].y.value;
  };

  renderLine = (imageId, markup, color) => {
    console.log("Im rendering for image", imageId);
    const data = JSON.parse(JSON.stringify(line));
    data.color = color;
    data.aimId = markup.aimUid;
    data.invalidated = true;
    this.createLinePoints(data, markup.coordinates);
    const currentState = cornerstoneTools.globalImageIdSpecificToolStateManager.saveToolState();
    this.checkNCreateToolForImage(currentState, imageId, "Length");
    currentState[imageId]["Length"].data.push(data);
    cornerstoneTools.globalImageIdSpecificToolStateManager.restoreToolState(
      currentState
    );
  };

  createLinePoints = (data, points) => {
    data.handles.start.x = points[0].x.value;
    data.handles.start.y = points[0].y.value;
    data.handles.end.x = points[1].x.value;
    data.handles.end.y = points[1].y.value;
  };

  renderPolygon = (imageId, markup, color) => {
    const data = JSON.parse(JSON.stringify(freehand));
    data.color = color;
    data.aimId = markup.aimUid;
    data.invalidated = true;
    this.createPolygonPoints(data, markup.coordinates);
    const currentState = cornerstoneTools.globalImageIdSpecificToolStateManager.saveToolState();
    this.checkNCreateToolForImage(currentState, imageId, "FreehandRoi");
    currentState[imageId]["FreehandRoi"].data.push(data);
    cornerstoneTools.globalImageIdSpecificToolStateManager.restoreToolState(
      currentState
    );
  };

  createPolygonPoints = (data, points) => {
    const freehandPoints = [];
    const modulo = points.length;
    points.forEach((point, index) => {
      const linesIndex = (index + 1) % modulo;
      const freehandPoint = {};
      freehandPoint.x = point.x.value;
      freehandPoint.y = point.y.value;
      freehandPoint.highlight = true;
      freehandPoint.active = true;
      freehandPoint.lines = [
        { x: points[linesIndex].x.value, y: points[linesIndex].y.value },
      ];
      freehandPoints.push(freehandPoint);
    });
    data.handles.points = [...freehandPoints];
  };

  renderPoint = (imageId, markup, color) => {
    const data = JSON.parse(JSON.stringify(probe));
    data.color = color;
    data.aimId = markup.aimUid;
    data.handles.end.x = markup.coordinates[0].x.value;
    data.handles.end.y = markup.coordinates[0].y.value;
    const currentState = cornerstoneTools.globalImageIdSpecificToolStateManager.saveToolState();
    this.checkNCreateToolForImage(currentState, imageId, "Probe");
    currentState[imageId]["Probe"].data.push(data);
    cornerstoneTools.globalImageIdSpecificToolStateManager.restoreToolState(
      currentState
    );
  };

  renderCircle = (imageId, markup, color) => {
    const data = JSON.parse(JSON.stringify(circle));
    data.invalidated = true; //so it calculates the stats
    data.color = color;
    data.aimId = markup.aimUid;
    data.handles.start.x = markup.coordinates[0].x.value;
    data.handles.start.y = markup.coordinates[0].y.value;
    data.handles.end.x = markup.coordinates[1].x.value;
    data.handles.end.y = markup.coordinates[1].y.value;
    const currentState = cornerstoneTools.globalImageIdSpecificToolStateManager.saveToolState();
    this.checkNCreateToolForImage(currentState, imageId, "CircleRoi");
    currentState[imageId]["CircleRoi"].data.push(data);
    cornerstoneTools.globalImageIdSpecificToolStateManager.restoreToolState(
      currentState
    );
  };

  checkUnsavedData = (isCancel, message = "") => {
    if (isCancel === true) {
      if (message === "")
        message = "All unsaved data will be lost! Do you want to continue?";
      var answer = window.confirm(message);
      if (!answer) {
        return 0;
      }
    }
    return 1;
  };

  closeAimEditor = (isCancel, message = "") => {
    // if aim editor has been cancelled ask to user
    if (this.state.dirty && !this.checkUnsavedData(isCancel, message)) return;
    this.setState({
      showAimEditor: false,
      selectedAim: undefined,
      hasSegmentation: false,
      activeLabelMapIndex: 0,
    });
    this.props.dispatch(clearActivePortAimID()); //this data is rendered so clear the aim Id in props
    this.renderAims(true);
    // this.refreshAllViewports();
    return 1;
  };

  closeViewport = () => {
    // closes the active viewport
    if (this.state.showAimEditor) {
      window.alert(
        "Before closing the viewport you should first close the aim editor!"
      );
      return;
    }
    this.props.dispatch(closeSerie());
  };

  handleHideAnnotations = () => {
    this.setState({ showAnnDetails: false });
  };

  getMarkupTypesForAim = (aimUid) => {
    let markupTypes = [];
    const imageAnnotations = this.props.series[this.props.activePort]
      .imageAnnotations;
    Object.entries(imageAnnotations).forEach(([key, values]) => {
      values.forEach((value) => {
        if (value.aimUid === aimUid) markupTypes.push(value.markupType);
      });
    });
    return markupTypes;
  };
  // this is in aimEditor. should be somewhare common so both can use (the new aimapi library)
  parseImgeId = (imageId) => {
    if (imageId.includes("objectUID=")) return imageId.split("objectUID=")[1];
    return imageId.split("/").pop();
  };
  newImage = (event) => {
    let { imageId } = event.detail.image;
    imageId = this.parseImgeId(imageId); //strip from cs imagePath to imageId
    const { activePort } = this.props;
    const tempData = this.state.data;
    const activeElement = cornerstone.getEnabledElements()[activePort];
    const { data } = cornerstoneTools.getToolState(
      activeElement.element,
      "stack"
    );
    tempData[activePort].stack = data[0];
    // set the state to preserve the imageId
    this.setState({ data: tempData });
    // dispatch to write the newImageId to store
    this.props.dispatch(updateImageId(imageId));
  };

  onAnnotate = () => {
    this.setState({ showAimEditor: true });
  };
  handleClose = (i) => {
    if (this.props.activePort !== i) {
      this.setActive(i);
      return;
    }
    this.closeViewport();
  };

  // Triggered by event from right bar to jump to the image of aim
  jumpToAimImage = (event) => {
    const { slideNo, activePort } = event.detail;
    const imageIndex = slideNo - 1;
    console.log("Slide no", slideNo);
    this.jumpToImage(imageIndex, activePort);
  };

  // Don't take the activePort Index from props because store updates late so
  // activePort may be null while the event is triggered
  jumpToImage = (imageIndex, activePortIndex) => {
    const newData = [...this.state.data];
    newData[activePortIndex].stack.currentImageIdIndex = parseInt(
      imageIndex,
      10
    );
    this.setState({ data: newData });
  };

  handleJumpChange = (i, event) => {
    if (this.props.activePort !== i) {
      this.setActive(i);
      return;
    }
    let imageIndex = event.target.value - 1;
    const images = this.state.data[this.props.activePort].stack.imageIds;
    // check if there is such an image
    if (isNaN(imageIndex) || !images[imageIndex]) return;
    this.jumpToImage(imageIndex, i);
  };

  render() {
    const { series } = this.props;
    if (this.state.redirect) return <Redirect to="/search" />;
    return !Object.entries(this.props.series).length ? (
      <Redirect to="/search" />
    ) : (
      <React.Fragment>
        <RightsideBar
          showAimEditor={this.state.showAimEditor}
          selectedAim={this.state.selectedAim}
          onCancel={this.closeAimEditor}
          hasSegmentation={this.state.hasSegmentation}
          activeLabelMapIndex={this.state.activeLabelMapIndex}
          updateProgress={this.props.updateProgress}
          updateTreeDataOnSave={this.props.updateTreeDataOnSave}
          setAimDirty={this.setDirtyFlag}
        >
          <ToolMenu />
          {!this.state.isLoading &&
            Object.entries(this.props.series).length &&
            this.state.data.map((data, i) => (
              <div
                className={
                  "viewportContainer" +
                  (this.props.activePort == i ? " selected" : "")
                }
                key={i}
                id={"viewportContainer" + i}
                style={{
                  width: this.state.width,
                  height: this.state.height,
                  display: "inline-block",
                }}
                onClick={() => this.setActive(i)}
              >
                <div className={"row"}>
                  <div className={"column left"}>
                    <span
                      className={"dot"}
                      style={{ background: "#ED594A" }}
                      onClick={() => this.handleClose(i)}
                    >
                      <FaTimes />
                    </span>
                    <span
                      className={"dot"}
                      style={{ background: "#5AC05A" }}
                      onClick={() => this.hideShow(i)}
                    >
                      <FaExpandArrowsAlt />
                    </span>
                  </div>
                  <div className={"column middle"}>
                    {/* <label>{series[i].seriesUID}</label> */}
                  </div>
                  <div className={"column middle-right"}>
                    <Form inline>
                      <Form.Group>
                        <Form.Label htmlFor="imageNum">{"Slice # "}</Form.Label>
                        <Form.Control
                          type="number"
                          min="1"
                          value={data.stack.currentImageIdIndex + 1}
                          onChange={(event) => this.handleJumpChange(i, event)}
                          style={{
                            width: "60px",
                            height: "10px",
                            opacity: 1,
                          }}
                        />
                      </Form.Group>
                    </Form>
                  </div>
                  <div className={"column right"}>
                    <span
                      className={"dot"}
                      style={{ background: "#FDD800", float: "right" }}
                      onClick={() => {
                        this.setState({ showAimEditor: true });
                      }}
                    >
                      <FaPen />
                    </span>
                  </div>
                </div>
                <CornerstoneViewport
                  key={i}
                  imageIds={data.stack.imageIds}
                  imageIdIndex={data.stack.currentImageIdIndex}
                  viewportIndex={i}
                  tools={tools}
                  eventListeners={[
                    {
                      target: "element",
                      eventName: "cornerstonetoolsmeasurementcompleted",
                      handler: this.measurementCompleted,
                    },
                    {
                      target: "element",
                      eventName: "cornerstonetoolsmeasurementmodified",
                      handler: this.measuremementModified,
                    },
                    {
                      target: "element",
                      eventName: "cornerstonetoolsmeasurementremoved",
                      handler: this.measurementRemoved,
                    },
                    {
                      target: "element",
                      eventName: "cornerstonenewimage",
                      handler: this.newImage,
                    },
                  ]}
                  setViewportActive={() => this.setActive(i)}
                  isStackPrefetchEnabled={true}
                  style={{ height: "calc(100% - 26px)" }}
                />
              </div>
            ))}
          {/* <ContextMenu
            onAnnotate={this.onAnnotate}
            closeViewport={this.closeViewport}
          /> */}
        </RightsideBar>
      </React.Fragment>
    );
    // </div>
  }
}

export default withRouter(connect(mapStateToProps)(DisplayView));
