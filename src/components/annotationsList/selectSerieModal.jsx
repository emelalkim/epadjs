import React from "react";
import { connect } from "react-redux";
import { withRouter } from "react-router-dom";
import PropTypes from "prop-types";
import ReactTooltip from "react-tooltip";
import { Modal } from "react-bootstrap";
import {
  clearGrid,
  getWholeData,
  getSingleSerie,
  clearSelection,
  addToGrid
} from "./action";
import SelectionItem from "./containers/selectionItem";
import { FaRegCheckSquare } from "react-icons/fa";
import { getSeries, setSignificantSeries } from "../../services/seriesServices";
import "./annotationsList.css";
import { isSupportedModality } from "../../Utils/aid.js";
import { extendWith } from "lodash";
import { TiEject } from "react-icons/ti";
import * as questionaire from "../aimEditor/parseClass";
import { decryptAndAdd } from "services/decryptUrlService";

const message = {
  title: "Not enough ports to open series"
};

class selectSerieModal extends React.Component {
  // _isMounted = false;
  constructor(props) {
    super(props);
    this.state = {
      selectionType: "",
      selectionArr: [],
      // seriesList: [],
      selectedToDisplay: {},
      limit: 0,
      list: []
    };
    this.maxPort = parseInt(sessionStorage.getItem("maxPort"));
  }

  //get the serie list
  componentDidMount = async () => {
    let selectionType = "";
    let { selectedStudies, selectedSeries, selectedAnnotations } = this.props;
    selectedStudies = Object.values(selectedStudies);
    selectedSeries = Object.values(selectedSeries);
    selectedAnnotations = Object.values(selectedAnnotations);
    if (selectedStudies.length > 0) {
      selectionType = "study";
    } else if (selectedSeries.length > 0) {
      selectionType = "series";
    } else {
      selectionType = "aim";
    }
    this.setState({ selectionType });
    this.setPreSelecteds();
    const limit = this.updateLimit();
    this.setState({ limit });

    // teaching file save related
    const { isTeachingFile } = this.props;
    if (isTeachingFile) {
      const element = document.getElementById("questionaire");
      const newElement = document.getElementById("questionaire2");

      const { projectMap, openSeries, activePort, templates: allTemplates } = this.props;
      console.log("props", this.props);
      // const { projectID } = openSeries[activePort];
      // let projectID = "lite";
      // console.log("Leyn", projectMap);
      // const { defaultTemplate, templates } = projectMap[projectID];
      // const projectTemplates = Object.keys(allTemplates)
      //   .filter((key) => templates.includes(key))
      //   .reduce((arr, key) => {
      //     arr.push(allTemplates[key]);
      //     return arr;
      //   }, []);

      this.semanticAnswers = new questionaire.AimEditor(
        element,
        this.validateForm,
        this.renderButtons,
        "",
        {},
        null,
        true, // is teachinng flag
        newElement // the new div which holds only teaching components for aim editor
      );
      this.semanticAnswers.loadTemplates({
        default: "99EPAD_15",
        all: allTemplates,
      });
      this.semanticAnswers.createViewerWindow();

      //cavit --- teaching file related part

    };// end teaching file related part
  }
  componentWillUnmount = () => {
    this._isMounted = false;
  };

  renderButtons = () => {
  };
  validateForm = (hasError) => {
    if (hasError > 0) {
      console.warn("Answer form has error/s!!!");
      // this.setState({
      //   saveButtonIsActive: false,
      // });
    } else {
      // this.setState({
      //   saveButtonIsActive: true,
      // });
    };
  };

  getSerieListData = async (projectID, patientID, studyUID) => {
    const { data: series } = await getSeries(projectID, patientID, studyUID);

    return series;
  };

  componentDidUpdate = prevProps => {
    const { openSeries, seriesPassed } = this.props;
    if (openSeries.length !== prevProps.openSeries.length) {
      let limit = this.updateLimit();
      this.setState({ limit });
    }
    if (seriesPassed.length !== prevProps.seriesPassed.length) {
      this.setPreSelecteds();
    }
  };

  updateLimit = () => {
    let selectCount = 0;
    const { openSeries } = this.props;
    const { selectedToDisplay } = this.state;
    selectCount = Object.keys(selectedToDisplay).length;
    return openSeries.length + selectCount;
  };

  selectToDisplay = serieUID => {
    let newSelections = { ...this.state.selectedToDisplay };
    if (newSelections[serieUID])
      delete newSelections[serieUID];
    else newSelections[serieUID] = true;
    this.setState({ selectedToDisplay: { ...newSelections } }, () => {
      let limit = this.updateLimit();
      this.setState({ limit });
    });
  };

  findSerieFromSeries = (serieUID, seriesArray) => {
    for (let i = 0; i < seriesArray.length; i++) {
      if (serieUID === seriesArray[i].seriesUID)
        return seriesArray[i];
    }
  }

  displaySelection = async () => {
    let studies = Object.values(this.props.seriesPassed);
    const { selectedToDisplay } = this.state;
    let series = [];
    let significantSeries = [];
    let significanceOrder = 1;
    // TODO: what is the logic here?
    studies.forEach(arr => {
      series = series.concat(arr);
    });
    let significanceSet = series.some(serie => serie.significanceOrder > 0);

    // let series = Object.values(this.props.seriesPassed)[0];
    //concatanete all arrays to getther
    for (let key of Object.keys(selectedToDisplay)) {
      if (!significanceSet) {
        significantSeries.push({
          seriesUID: key,
          significanceOrder
        });
        significanceOrder++;
      }
      let serie = this.findSerieFromSeries(key, series);
      this.props.dispatch(addToGrid(serie, serie.aimID));
      if (this.state.selectionType === "aim") {
        this.props.dispatch(getSingleSerie(serie, serie.aimID));
      } else {
        this.props.dispatch(getSingleSerie(serie));
      }
    }
    // for (let i = 0; i < Object.keys(selectedToDisplay).length; i++) {
    //   // if (this.state.selectedToDisplay[i]) {
    //   // If significance order is not set before we 
    //   if (!significanceSet) {
    //     significantSeries.push({
    //       seriesUID: series[i].seriesUID,
    //       significanceOrder
    //     });
    //     significanceOrder++;
    //   }
    //   this.props.dispatch(addToGrid(series[i], series[i].aimID));
    //   if (this.state.selectionType === "aim") {
    //     this.props.dispatch(getSingleSerie(series[i], series[i].aimID));
    //   } else {
    //     this.props.dispatch(getSingleSerie(series[i]));
    //   }
    //   // }
    // }
    const { projectID, patientID, studyUID, subjectID } = series[0];
    const subID = patientID ? patientID : subjectID;

    if (!significanceSet) {
      setSignificantSeries(projectID, subID, studyUID, significantSeries);
    }
    this.props.history.push("/display");
    this.handleCancel();
  };

  groupUnderPatient = objArr => {
    let groupedObj = {};
    for (let item of objArr) {
      groupedObj[item.patientID] = item;
    }
    return groupedObj;
  };

  handleCancel = () => {
    this.setState({
      selectionType: "",
      selectionArr: [],
      seriesList: [],
      selectedToDisplay: [],
      limit: 0
    });
    // this.props.dispatch(clearSelection());
    this.props.onCancel();
  };

  setPreSelecteds = () => {
    const { seriesPassed, openSeries } = this.props;
    if (openSeries.length === this.maxPort)
      return;
    let selectedToDisplay = {};
    let selectedCount = 0;
    let series = Object.values(seriesPassed);
    let count = 0;
    for (let i = 0; i < series.length; i++) {
      for (let k = 0; k < series[i].length; k++) {
        if (openSeries.length + selectedCount >= this.maxPort) {
          this.setState({ selectedToDisplay }, () => {
            this.setState({ limit: this.updateLimit() });
          });
          return;
        }
        // if (!this.isSerieOpen(series[i][k].seriesUID)) {
        //   selectedToDisplay[series[i][k].seriesUID] = series[i][k].significanceOrder
        //     ? true
        //     : false;
        //   selectedCount++;
        // }
        if (series[i][k].significanceOrder && !this.isSerieOpen(series[i][k].seriesUID)) {
          selectedToDisplay[series[i][k].seriesUID] = true;
          selectedCount++;
        }
      }
      count += series[i].length;
    }
    this.setState({ selectedToDisplay }, () => {
      this.setState({ limit: this.updateLimit() });
    });
  };

  isSerieOpen = serieUID => {
    const { openSeries, studyName } = this.props;
    let openSeriesUIDList = [];
    openSeries.forEach(port => {
      openSeriesUIDList.push(port.seriesUID);
    });
    return openSeriesUIDList.includes(serieUID);
  };

  getTitle = (serie) => {
    const { studyName, selectedStudies } = this.props;
    let title = studyName ? studyName
      : serie.bodyPart || serie.studyDescription;
    if (!title) {
      if (selectedStudies[serie.studyUID]) {
        title = selectedStudies[serie.studyUID].studyDescription;
      }
    }
    title = !title ? "Unnamed Study" : title;
    return title;
  }

  renderSelection = () => {
    const { seriesPassed } = this.props;
    const { selectedToDisplay, limit } = this.state;
    let selectionList = [];
    let item;

    let series = Array.isArray(seriesPassed)
      ? seriesPassed
      : Object.values(seriesPassed);
    let keys = Object.keys(seriesPassed);
    let count = 0;
    let significantExplanation = false; //Explanations at the bottom of the modal

    // filter the series according to displayable modalities
    for (let i = 0; i < series.length; i++) {
      series[i] = series[i].filter(isSupportedModality);
    }

    for (let i = 0; i < series.length; i++) {
      let innerList = [];

      for (let k = 0; k < series[i].length; k++) {
        const { seriesUID } = series[i][k];
        let alreadyOpen = this.isSerieOpen(seriesUID);
        let disabled =
          !selectedToDisplay[seriesUID] &&
          limit >= this.maxPort;
        let desc = series[i][k].seriesDescription || "Unnamed Serie";
        if (series[i][k].significanceOrder) {
          desc = desc + " (S)";
          significantExplanation = true;
        }
        item = alreadyOpen ? (
          <div>
            <div
              key={k + "_" + seriesUID}
              className="alreadyOpen-disabled"
            >
              <FaRegCheckSquare data-tip data-for={"alreadyOpenSeries"} />
              <div className="selectionItem-text">{desc}</div>
            </div>
            <ReactTooltip
              id="alreadyOpenSeries"
              place="right"
              type="info"
              delayShow={100}
              clickable={false}
            >
              <span>{"Already Open"}</span>
            </ReactTooltip>
          </div>
        ) : (
          <SelectionItem
            desc={desc}
            onChange={() => this.selectToDisplay(seriesUID)}
            index={count + k}
            disabled={disabled}
            key={k + "_" + seriesUID}
            isChecked={selectedToDisplay[seriesUID]}
          />
        );
        innerList.push(item);
      }
      selectionList.push(
        <div key={keys[i]}>
          <div className="serieSelection-title">{this.getTitle(series[i][0])}</div>
          <div>{innerList}</div>
        </div>
      );
      count += series[i].length;
    }
    if (significantExplanation)
      selectionList.push(<div><br />(S): Significant series</div>);
    return selectionList;
  };

  saveTeachingFile = async () => {
    const { encArgs } = this.props;
    if (!encArgs) {
      // Warn user
      return;
    }
    await decryptAndAdd(encArgs);
    const answers = this.semanticAnswers.saveAim();
    console.log("Answers", answers);
    answers.name = "Teaching File";
    const aim = createStudyAim(study, answers);
    const aimJson = aim.getAim();
    let aimSaved = JSON.parse(aimJson);

    const aimID = aimSaved.ImageAnnotationCollection.uniqueIdentifier.root;
    const { openSeries, activePort } = this.props;
    const { patientID, projectID, seriesUID, studyUID } = openSeries[
      activePort
    ];
    const name =
      aimSaved.ImageAnnotationCollection.imageAnnotations.ImageAnnotation[0]
        .name.value;
    const comment =
      aimSaved.ImageAnnotationCollection.imageAnnotations.ImageAnnotation[0]
        .comment.value;
    const aimRefs = {
      aimID,
      patientID,
      projectID,
      seriesUID,
      studyUID,
      name,
      comment,
      isStudyAim
    };

    uploadAim(aimSaved, projectID, this.state.isUpdate, this.updatedAimId)
      .then(() => {
        const { openSeries, activePort } = this.props;
        const { patientID, projectID, seriesUID, studyUID } = openSeries[
          activePort
        ];
        toast.success("Teaching File succesfully saved.", {
          position: "top-right",
          autoClose: 5000,
          hideProgressBar: false,
          closeOnClick: true,
          pauseOnHover: true,
          draggable: true,
        });
        openSeries.forEach(({ seriesUID, studyUID }) => {
          if (openSeries[
            activePort
          ].studyUID === studyUID && openSeries[
            activePort
          ].seriesUID !== seriesUID)
            this.props.dispatch(
              getSingleSerie({ patientID, projectID, seriesUID, studyUID })
            );
        });
        this.props.dispatch(
          getSingleSerie({ patientID, projectID, seriesUID, studyUID })
        );
        this.props.updateTreeDataOnSave(aimRefs);
      })
      .catch((error) => {
        alert(
          "Teaching file couldn't be saved! More information about the error can be found in the logs."
        );
        console.error(error);
      });

    // const aim = createAim(answers);
    // saveAim(aim);
  }

  render = () => {
    const { openSeries, isTeachingFile } = this.props;
    const selections = Object.keys(this.state.selectedToDisplay);
    const list = this.renderSelection();
    return (
      // <Modal.Dialog dialogClassName="alert-selectSerie">
      <Modal.Dialog id="modal-fix">
        <Modal.Header>
          <Modal.Title className="selectSerie__header">
            {message.title}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body
          className="selectSerie-container"
          style={{ textAlign: "start" }}
        >
          {isTeachingFile && (<div><div id="questionaire"> </div>
            <div id="questionaire2"> </div></div>)}
          <div>Maximum {this.maxPort} series can be viewed at a time.</div>
          {openSeries.length > 0 && (
            <div>
              You can close open series to open veiwport space for new one.
              <br />
              <button
                size="lg"
                className="selectSerie-clearButton"
                onClick={() => this.props.dispatch(clearGrid())}
              >
                X  - Close all series
              </button>
            </div>
          )}
          {/* <button
            size="lg"
            className="selectSerie-clearButton"
            onClick={() => this.props.dispatch(clearGrid())}
          >
            X  - Close all series
          </button> */}
          {this.state.limit > this.maxPort && !openSeries.length && (
            <div>Please select only {this.maxPort} series to open!</div>
          )}
          <div>{list}</div>
        </Modal.Body>
        <Modal.Footer className="modal-footer__buttons">
          {isTeachingFile && (
            <div>
              <button onClick={this.saveTeachingFile}>Save Teaching File</button>
              <button onClick={this.saveTeachingFileAndDisplay}>Save Teaching File & Display</button>
              <button onClick={this.handleCancel}>Discard</button>
            </div>
          )}
          <button onClick={this.displaySelection} disabled={!selections.length}>Display selection</button>
          <button onClick={this.handleCancel}>Cancel</button>
        </Modal.Footer>
      </Modal.Dialog>
    );
  };
}

const mapStateToProps = state => {
  return {
    selectedStudies: state.annotationsListReducer.selectedStudies,
    selectedSeries: state.annotationsListReducer.selectedSeries,
    selectedAnnotations: state.annotationsListReducer.selectedAnnotations,
    patients: state.annotationsListReducer.patients,
    openSeries: state.annotationsListReducer.openSeries,
    projectMap: state.annotationsListReducer.projectMap,
    activePort: state.annotationsListReducer.activePort,
    templates: state.annotationsListReducer.templates,
  };
};

export default withRouter(connect(mapStateToProps)(selectSerieModal));
