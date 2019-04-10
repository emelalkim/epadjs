import React from "react";
import { connect } from "react-redux";
// import Collapse from "react-bootstrap/Collapse";
import { FaMinus, FaPlus } from "react-icons/fa";

import Annotations from "./annotations";
import {
  updateAnnotation,
  toggleAllAnnotations,
  toggleAllLabels,
  changeActivePort,
  getAnnotationListData,
  getSingleSerie
} from "../action";

//single serie will be passed
class ListItem extends React.Component {
  state = {
    isSerieOpen: false,
    collapseAnnList: false,
    displayAnnotations: false,
    displayLabels: false
  };

  componentDidMount = () => {
    console.log("list item props", this.props);
    this.setState({
      isSerieOpen: this.props.selected,
      collapseAnnList: this.checkIfSerieOpen(this.props.serie.seriesUID).isOpen,
      displayAnnotations: this.checkIfSerieOpen(this.props.serie.seriesUID)
        .isOpen,
      displayLabels: this.checkIfSerieOpen(this.props.serie.seriesUID).isOpen
    });
  };

  handleCollapse = () => {
    this.setState(state => ({ collapseAnnList: !state.collapseAnnList }));
  };

  checkIfSerieOpen = selectedSerie => {
    let isOpen = false;
    let index;
    this.props.openSeries.forEach((serie, i) => {
      if (serie.seriesUID === selectedSerie) {
        isOpen = true;
        index = i;
      }
    });
    return { isOpen, index };
  };

  handleAnnotationClick = async e => {
    const { seriesUID, studyUID, patientID } = this.props.serie;
    const { value, checked } = e.target;
    const { seriesid } = e.target.dataset;
    //check if the current serie match, if matches update the annotation
    const openSeriesUID = this.props.openSeries[this.props.activePort]
      .seriesUID;
    if (openSeriesUID === seriesid) {
      this.props.dispatch(
        updateAnnotation(seriesUID, studyUID, patientID, value, checked)
      );
    } else {
      //if doesn't match check if the serie exists in the open series
      const isOpen = this.checkIfSerieOpen(seriesid).isOpen;
      const index = this.checkIfSerieOpen(seriesid).index;
      if (isOpen) {
        // if it exists in the openSeries update activeport
        this.props.dispatch(changeActivePort(index));
        //update the status of the clicked annotation
        this.props.dispatch(
          updateAnnotation(seriesUID, studyUID, patientID, value, checked)
        );
      } else {
        //else get single serie dispatch action
        await this.props.dispatch(getSingleSerie(this.props.serie, value));
        this.props.dispatch(
          updateAnnotation(seriesUID, studyUID, patientID, value, checked)
        );
      }
    }
  };

  handleToggleSerie = async e => {
    //select de select all anotations
    const { patientID, seriesUID, studyUID } = this.props.serie;
    const { seriesid } = e.target.dataset;
    const openSeriesUID = this.props.openSeries[this.props.activePort]
      .seriesUID;
    //if isSerieOpen
    if (openSeriesUID === seriesid) {
      // if (this.state.isSerieOpen) {
      await this.setState(state => ({
        displayAnnotations: !state.displayAnnotations
      }));
      this.props.dispatch(
        toggleAllAnnotations(
          patientID,
          studyUID,
          seriesUID,
          this.state.displayAnnotations
        )
      );
    } else {
      //if doesn't match check if the serie exists in the open series
      const isOpen = this.checkIfSerieOpen(seriesid).isOpen;
      const index = this.checkIfSerieOpen(seriesid).index;
      console.log("default checked", e.target.defaultChecked);
      if (isOpen) {
        //if in the open series change the active port
        console.log("serie open yes");
        this.props.dispatch(changeActivePort(index));
      }
      //check if user toggle on or off and change the state accordingly
    }
    //if it doesn't exist in the open series dispatch the action to add
    //dispatch yap ve o serie icin viewport ac openSeriese ekle
  };

  handleToggleLabels = async e => {
    //select de select all anotations
    const { patientID, seriesUID, studyUID } = this.props.serie;
    const { seriesid } = e.target.dataset;
    const openSeriesUID = this.props.openSeries[this.props.activePort]
      .seriesUID;
    //if isSerieOpen
    // if (this.state.isSerieOpen) {
    if (openSeriesUID === seriesid) {
      console.log("got here with labels");
      await this.setState(state => ({
        displayLabels: !state.displayLabels
      }));
      this.props.dispatch(
        toggleAllLabels(
          patientID,
          studyUID,
          seriesUID,
          this.state.displayLabels
        )
      );
    } else {
    }
    //dispatch yap ve o serie icin viewport ac openSeriese ekle
  };

  render = () => {
    const {
      seriesDescription,
      seriesUID,
      studyUID,
      patientID
    } = this.props.serie;
    let desc =
      seriesDescription.length === 0 ? "unnamed serie" : seriesDescription;

    const numOfAnn = this.props.serie.annotations
      ? Object.values(this.props.serie.annotations).length
      : 0;
    return (
      <>
        <div className="-serieButton__container" onClick={this.handleCollapse}>
          <button className="annList-serieButton">
            {this.state.collapseAnnList ? (
              <FaMinus className="-serieButton__icon" />
            ) : (
              <FaPlus className="-serieButton__icon" />
            )}
            <span className="-serieButton__value">
              {desc} - ({numOfAnn})
            </span>
          </button>
        </div>
        {this.state.collapseAnnList && (
          <Annotations
            handleCheck={this.handleAnnotationClick}
            seriesUID={seriesUID}
            studyUID={studyUID}
            patient={patientID}
            showAnns={this.state.displayAnnotations}
            onToggleSerie={this.handleToggleSerie}
            showLabels={this.state.displayLabels}
            onToggleLabels={this.handleToggleLabels}
          />
        )}
      </>
    );
  };
}
const mapStateToProps = state => {
  return {
    openSeries: state.annotationsListReducer.openSeries,
    activePort: state.annotationsListReducer.activePort
  };
};
export default connect(mapStateToProps)(ListItem);

{
  /* <label>
  <span>Switch with default style</span>
  <Switch onChange={this.handleChange} checked={this.state.checked} />
</label>; */
}