import React, { Component } from "react";
import { connect } from "react-redux";
import Draggable from "react-draggable";
import { getTemplates } from "../../services/templateServices";
import * as questionaire from "../../utils/AimEditorReactV1/parseClass.js";
import Aim from "./Aim";
import * as dcmjs from "dcmjs";

import "./aimEditor.css";

const enumAimType = {
  imageAnnotation: 1,
  seriesAnnotation: 2,
  studyAnnotation: 3
};

class AimEditor extends Component {
  constructor(props) {
    super(props);
    this.cornerstone = this.props.cornerstone;
    this.csTools = this.props.csTools;
    this.image = this.getImage();
    this.person = this.getPatientData(this.image);
    this.equipment = this.getEquipmentData(this.image);
    this.accession = this.getAccession(this.image);
  }

  componentDidMount() {
    const element = document.getElementById("questionaire");
    // const templateId = "1";
    // const {
    //   data: {
    //     ResultSet: { Result: templates }
    //   }
    // } = await getTemplates(templateId);
    //
    // Change the static projectId above with the value in store
    //

    var shoutOutValidation = message => {
      alert(message);
    };
    var semanticAnswers = new questionaire.AimEditor(
      element,
      shoutOutValidation
    );
    semanticAnswers.loadTemplates(questionaire.templateArray);
    semanticAnswers.createViewerWindow(element);
    if (this.props.aimId != null && Object.entries(this.props.aimId).length)
      semanticAnswers.loadAimJson(this.props.aimId);
  }

  getImage = () => {
    return this.cornerstone.getImage(
      this.cornerstone.getEnabledElements()[this.props.activePort]["element"]
    );
  };

  getPatientData = image => {
    const sex = image.data.string("x00100040") || "";
    const name = image.data.string("x00100010") || "";
    const patientId = image.data.string("x00100020") || "";
    const birthDate = image.data.string("x00100030") || "";
    const person = {
      sex: { value: sex },
      name: { value: name },
      id: { value: patientId },
      birthDate: { value: birthDate }
    };
    return person;
  };

  getEquipmentData = image => {
    const manuName = image.data.string("x00080070") || "";
    const manuModel = image.data.string("x00081090") || "";
    const sw = image.data.string("x00181020") || "";
    const equipment = {
      manufacturerName: manuName,
      manufacturerModelName: manuModel,
      softwareVersion: sw
    };
    return equipment;
  };

  getAccession = image => {
    return image.data.string("x00080050") || "";
  };

  render() {
    return (
      <Draggable>
        <div className="editorForm">
          <div id="questionaire" />
          <button type="button" onClick={this.save}>
            Save
          </button>
          <button type="button" onClick={this.cancel}>
            Cancel
          </button>
        </div>
      </Draggable>
    );
  }

  cancel = () => {
    if (this.props.onCancel) {
      this.props.onCancel();
    }
  };

  save = () => {
    console.log("cstools are", this.csTools);
    console.log(
      "yabadabadu",
      this.csTools.getToolState(
        this.cornerstone.getEnabledElements()[0]["element"],
        "BrushTool"
      )
    );
    this.createAim();
  };

  createAim = () => {
    const hasSegmentation = false; //TODO:keep this in store and look dynamically
    var aim = new Aim(
      this.image,
      this.studyUid,
      this.equipment,
      this.accession,
      this.person,
      enumAimType.imageAnnotation,
      hasSegmentation
    );

    const updatedAimId = this.props.aimId; //needs to be setted

    const { toolState } = this.csTools.globalImageIdSpecificToolStateManager;

    // get the imagesIds for active viewport
    const element = document.getElementsByClassName("viewport-element")[
      this.props.activePort
    ];
    const stackToolState = this.csTools.getToolState(element, "stack");
    const imageIds = stackToolState.data[this.props.activePort].imageIds;

    // check which images has markup or segmentation
    const markedImageIds = imageIds.filter(imageId => {
      if (toolState[imageId] === undefined) return false;
      return true;
    });

    // if has segmentation retrieve the images to generate dicomseg, most should be cached already
    if (hasSegmentation) {
      var imagePromises = [];
      imageIds.map(imageId => {
        imagePromises.push(this.cornerstone.loadImage(imageId));
      });
      this.createSegmentation(toolState, imagePromises, markedImageIds);
    }

    // check for markups
    var shapeIndex = 1;
    markedImageIds.map(imageId => {
      const imageReferenceUid = this.parseImgeId(imageId);
      const markUps = toolState[imageId];
      Object.keys(markUps).map(tool => {
        switch (tool) {
          case "FreehandMouse":
            console.log("FreeHandMouse");
            const polygons = markUps[tool].data;
            polygons.map(polygon => {
              if (!polygon.aimId || polygon.aimId === updatedAimId) {
                //dont save the same markup to different aims
                this.addPolygonToAim(
                  aim,
                  polygon,
                  shapeIndex,
                  imageReferenceUid
                );
                shapeIndex++;
              }
            });
            break;
          case "Bidirectional":
            console.log("Bidirectional ", markUps[tool]);
            shapeIndex++;
            break;
          case "RectangleRoi":
            console.log("RectangleRoi ", markUps[tool]);
            shapeIndex++;
            break;
          case "EllipticalRoi":
            console.log("EllipticalRoi ", markUps[tool]);
            shapeIndex++;
            break;
          case "CircleRoi":
            console.log("CircleRoi ", markUps[tool]);
            const circles = markUps[tool].data;
            circles.map(circle => {
              if (!circle.aimId || circle.aimId === updatedAimId) {
                //dont save the same markup to different aims
                this.addCircleToAim(aim, circle, shapeIndex, imageReferenceUid);
                shapeIndex++;
              }
            });
            break;
          case "Length":
            const lines = markUps[tool].data;
            lines.map(line => {
              if (!line.aimId || line.aimId === updatedAimId) {
                //dont save the same markup to different aims
                this.addLineToAim(aim, line, shapeIndex);
                shapeIndex++;
              }
            });
        }
      });
    });
    aim.save();
  };

  addPolygonToAim = (aim, polygon, shapeIndex, imageReferenceUid) => {
    const { points } = polygon.handles;
    const markupId = aim.addMarkupEntity(
      "TwoDimensionPolyline",
      shapeIndex,
      points,
      imageReferenceUid
    );
    const { mean, stdDev, min, max } = polygon.meanStdDev;

    const meanId = aim.createMeanCalcEntity({ mean, unit: "[hnsf'U]" });
    aim.createImageAnnotationStatement(1, markupId, meanId);

    const stdDevId = aim.createStdDevCalcEntity({ stdDev, unit: "[hnsf'U]" });
    aim.createImageAnnotationStatement(1, markupId, stdDevId);

    const minId = aim.createMinCalcEntity({ min, unit: "[hnsf'U]" });
    aim.createImageAnnotationStatement(1, markupId, minId);

    const maxId = aim.createMaxCalcEntity({ max, unit: "[hnsf'U]" });
    aim.createImageAnnotationStatement(1, markupId, maxId);
  };

  addLineToAim = (aim, line, shapeIndex) => {
    const { start, end } = line.handles;
    const markupId = aim.addMarkupEntity("TwoDimensionPolyline", shapeIndex, [
      start,
      end
    ]);
    // aim.add;
  };

  addCircleToAim = (aim, circle, shapeIndex, imageReferenceUid) => {
    const { start, end } = circle.handles;
    const markupId = aim.addMarkupEntity(
      "TwoDimensionCircle",
      shapeIndex,
      [start, end],
      imageReferenceUid
    );
    const { mean, stdDev, min, max } = circle.cachedStats;
    console.log("circle", circle, "mean", mean, "stdDev", stdDev);

    const meanId = aim.createMeanCalcEntity({ mean, unit: "[hnsf'U]" });
    aim.createImageAnnotationStatement(1, markupId, meanId);

    const stdDevId = aim.createStdDevCalcEntity({ stdDev, unit: "[hnsf'U]" });
    aim.createImageAnnotationStatement(1, markupId, stdDevId);

    const minId = aim.createMinCalcEntity({ min, unit: "[hnsf'U]" });
    aim.createImageAnnotationStatement(1, markupId, minId);

    const maxId = aim.createMaxCalcEntity({ max, unit: "[hnsf'U]" });
    aim.createImageAnnotationStatement(1, markupId, maxId);
    console.log();
    // aim.add;
  };

  createSegmentation = (toolState, imagePromises, markedImageIds) => {
    const segments = [];
    console.log("marked Images are", markedImageIds);
    markedImageIds
      .filter(imageId => {
        if (
          toolState[imageId].brush === undefined ||
          toolState[imageId].brush.data === undefined
        )
          return false;
        return true;
      })
      .map(imageId => {
        console.log("I am in");
        this.setSegmentMetaData(toolState, imageId, segments);
      });
    const brushData = {
      toolState,
      segments
    };
    Promise.all(imagePromises).then(images => {
      console.log("images are", images, "brush data is", brushData);
      const segBlob = dcmjs.adapters.Cornerstone.Segmentation.generateSegmentation(
        images,
        brushData
      );
      console.log(segBlob);
      // Create a URL for the binary.
      // var objectUrl = URL.createObjectURL(segBlob);
      // window.open(objectUrl);
    });
  };

  setSegmentMetaData = (toolState, imageId, segments) => {
    console.log("imageIds are", imageId, "segments are", segments);
    const RecommendedDisplayCIELabValue = dcmjs.data.Colors.rgb2DICOMLAB([
      1,
      0,
      0
    ]);
    const brushData = toolState[imageId].brush.data;
    console.log("brush data is", brushData);
    for (let segIdx = 0; segIdx < 4; segIdx++) {
      // If there is pixelData for this segment, set the segment metadata
      // if it hasn't been set yet.
      if (
        brushData[segIdx] &&
        brushData[segIdx].pixelData &&
        !segments[segIdx]
      ) {
        segments[segIdx] = {
          SegmentedPropertyCategoryCodeSequence: {
            CodeValue: "T-D0050",
            CodingSchemeDesignator: "SRT",
            CodeMeaning: "Tissue"
          },
          SegmentNumber: (segIdx + 1).toString(),
          SegmentLabel: "Tissue " + (segIdx + 1).toString(),
          SegmentAlgorithmType: "SEMIAUTOMATIC",
          SegmentAlgorithmName: "Slicer Prototype",
          RecommendedDisplayCIELabValue,
          SegmentedPropertyTypeCodeSequence: {
            CodeValue: "T-D0050",
            CodingSchemeDesignator: "SRT",
            CodeMeaning: "Tissue"
          }
        };
      }
    }
  };

  addSegmentationToAim = (aim, image) => {
    // aim.
  };

  createDicomSeg = () => {};

  parseImgeId = imageId => {
    return imageId.split("objectUID=")[1].split("&")[0];
  };
  // testAimEditor = () => {
  //   //console.log(document.getElementById("cont"));
  //   var instanceAimEditor = new aim.AimEditor(document.getElementById("cont"));
  //   var myA = [
  //     { key: "BeaulieuBoneTemplate_rev18", value: aim.myjson },
  //     { key: "asdf", value: aim.myjson1 }
  //   ];
  //   instanceAimEditor.loadTemplates(myA);

  //   instanceAimEditor.addButtonsDiv();

  //   instanceAimEditor.createViewerWindow();
  // };
}
const mapStateToProps = state => {
  return {
    series: state.searchViewReducer.series,
    activePort: state.annotationsListReducer.activePort
  };
};
export default connect(mapStateToProps)(AimEditor);
