import aimConf from "./aimConf";
import { modalities } from "./modality";
import { generateUid } from "../../utils/aid";

class Aim {
  constructor(
    image,
    studyInstanceUid,
    equipment,
    accession,
    person,
    aimType,
    hasSegmentation,
    aim = {}
  ) {
    Object.assign(this, aim);
    this.image = image;
    this.aimVersion = aimConf.aimVersion;
    this.dateTime = this.getDate();
    this.seriesInstanceUid = { root: generateUid() };
    this.studyInstanceUid = { root: studyInstanceUid };
    this.imageAnnotations = this._createImageAnnotations(
      aimType,
      hasSegmentation
    );
    this["xsi:schemaLocation"] = aimConf["xsi:schemaLocation"];
    this.equipment = equipment;
    this["xmlns:xsi"] = aimConf["xmlns:xsi"];
    this["xmlns:rdf"] = aimConf["xmlns:rdf"];
    this.accessionNumber = { value: accession };
    this.xmlns = aimConf.xmlns;
    this.person = person;
    this.user = this.getUserInfo();
    this.fillImageSepcificData();
  }

  static parse(data) {
    return new Aim(data);
  }

  static getMarkups(aim) {
    var annotations = [];
    var annotation = {};
    const markupEntities =
      aim.imageAnnotations.ImageAnnotation.markupEntityCollection.MarkupEntity;

    if (markupEntities.constructor === Array) {
      markupEntities.map(markupEntity => {
        var imageId = markupEntity["imageReferenceUid"]["root"];
        var markupUid = markupEntity["uniqueIdentifier"]["root"];
        var calculations = this.getCalculationEntitiesOfMarkUp(aim, markupUid);
        annotations.push({
          imageId: imageId,
          markupType: markupEntity["xsi:type"],
          coordinates:
            markupEntity.twoDimensionSpatialCoordinateCollection
              .TwoDimensionSpatialCoordinate,
          calculations: calculations
        });
        this.getCalculationEntitiesOfMarkUp(aim);
      });
      return annotations;
    } else if (
      Object.entries(markupEntities).length !== 0 &&
      markupEntities.constructor === Object
    ) {
      const imageId = markupEntities["imageReferenceUid"]["root"];
      const markupUid = markupEntities["uniqueIdentifier"]["root"];
      const calculations = this.getCalculationEntitiesOfMarkUp(aim, markupUid);
      return {
        imageId: imageId,
        markupType: markupEntities["xsi:type"],
        coordinates:
          markupEntities.twoDimensionSpatialCoordinateCollection
            .TwoDimensionSpatialCoordinate,
        calculations: calculations
      };
    }
  }

  static getCalculationEntitiesOfMarkUp(aim, markupUid) {
    const imageAnnotationStatements = Aim.getImageAnnotationStatements(aim);
    // console.log("calculations for ", markupUid, " are");
    var calculations = [];
    imageAnnotationStatements.forEach(statement => {
      if (
        statement["xsi:type"] ==
          "CalculationEntityReferencesMarkupEntityStatement" &&
        statement.objectUniqueIdentifier.root === markupUid
      ) {
        const calculationUid = statement.subjectUniqueIdentifier.root;
        const calculationEntities = Aim.getCalculationEntities(aim);
        calculationEntities.forEach(calculation => {
          if (calculation.uniqueIdentifier.root === calculationUid)
            calculations.push(Aim.parseCalculation(calculation));
        });
      }
    });
    return calculations;
  }

  static parseCalculation(calculation) {
    const calcResult =
      calculation.calculationResultCollection.CalculationResult;
    var obj = {};
    obj["type"] = calculation["description"]["value"];
    obj["value"] = calcResult["value"]["value"];
    obj["unit"] = calcResult["unitOfMeasure"]["value"];
    // console.log(obj);
    return obj;
  }

  static getImageAnnotationStatements = aim => {
    return aim.imageAnnotations.ImageAnnotation
      .imageAnnotationStatementCollection.ImageAnnotationStatement;
  };

  static getCalculationEntities = aim => {
    return aim.imageAnnotations.ImageAnnotation.calculationEntityCollection
      .CalculationEntity;
  };

  fillImageSepcificData = () => {};

  getUserInfo = () => {
    var obj = {};
    obj.loginName = sessionStorage.getItem("username");
    obj.name = sessionStorage.getItem("displayName");
    return obj;
  };

  getDate = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = ("0" + (now.getMonth() + 1)).slice(-2);
    const day = ("0" + now.getDate()).slice(-2);
    const hours = ("0" + now.getHours()).slice(-2);
    const minutes = ("0" + now.getMinutes()).slice(-2);
    const seconds = ("0" + now.getSeconds()).slice(-2);
    return year + month + day + hours + minutes + seconds;
  };

  createObject = (name, value) => {
    var obj = {};
    obj[name] = { value };
    return obj;
  };

  // IN REFACTORING WE SHOULD CHANGE THIS CODE TO FOLLOWING FOR EFFICIENCY
  /*
var Vehicle = {
    type: "General",
    display: function(){console.log(this.type);}
}
var Car = Object.create(Vehicle); //create a new Car inherits from Vehicle
Car.type = "Car"; //overwrite the property
Car.display();//"Car"
Vehicle.display();//still "General"
*/

  /*                                          */
  /*  Calculation Entitiy Realted Functions   */
  /*                                          */

  createDimension = (label, index = 0, size = 1) => {
    return {
      Dimension: Object.assign(
        {},
        this.createObject("size", size),
        this.createObject("index", index),
        this.createObject("label", label)
      )
    };
  };

  createDoubleDataType = () => {
    var obj = {
      dataType: {
        code: "C48870",
        codeSystem: "NCI",
        "iso:displayName": { "xmlns:iso": "uri:iso.org:21090", value: "Double" }
      }
    };
    return obj;
  };

  //preLabel is used for preceding the name like LongAxis || ShortAxis
  createCalcResult = (unit, label, value, preLabel = "") => {
    var obj = this.createObject("unitOfMeasure", unit);
    Object.assign(obj, this.createDoubleDataType());
    obj["xsi:type"] = "CompactCalculationResult";
    obj["dimensionCollection"] = this.createDimension(preLabel + label);
    obj["type"] = "scalar";
    Object.assign(obj, this.createObject("value", value));
    return obj;
  };

  //if called with the default values returns DCM type code
  createTypeCode = (
    code = 11203,
    codeSystemName = "DCM",
    displayNameValue = "Attenuation Coefficient"
  ) => {
    var obj = {};
    obj["code"] = code;
    obj["codeSystemName"] = codeSystemName;
    obj["iso:displayName"] = {
      "xmlns:iso": "uri:iso.org:21090",
      value: displayNameValue
    };
    return obj;
  };

  createLengthCalcEntity = length => {
    let { unit, value } = length;
    var obj = {};
    obj["calculationResultCollection"] = {
      CalculationResult: this.createCalcResult(unit, "LineLength", value)
    };
    obj["description"] = { value: "Length" };
    const uId = generateUid();
    obj["uniqueIdentifier"] = { root: uId };
    obj["typeCode"] = [this.createTypeCode("G-D7FE", "SRT", "Length")];
    this.aim.imageAnnotations.ImageAnnotation.calculationEntityCollection[
      "CalculationEntity"
    ].push(obj);
    return uId;
  };

  createLongAxisCalcEntity = longAxis => {
    let { unit, value } = longAxis;
    var obj = {};
    obj["calculationResultCollection"] = {
      CalculationResult: this.createCalcResult(unit, "LongAxis", value)
    };
    obj["description"] = { value: "LongAxis" };
    const uId = generateUid();
    obj["uniqueIdentifier"] = { root: uId };
    obj["typeCode"] = [this.createTypeCode("G-A185", "SRT", "LongAxis")];
    this.aim.imageAnnotations.ImageAnnotation.calculationEntityCollection[
      "CalculationEntity"
    ].push(obj);
    return uId;
  };

  createShortAxisCalcEntity = shortAxis => {
    let { unit, value } = shortAxis;
    var obj = {};
    obj["calculationResultCollection"] = {
      CalculationResult: this.createCalcResult(unit, "ShortAxis", value)
    };
    obj["description"] = { value: "ShortAxis" };
    const uId = generateUid();
    obj["uniqueIdentifier"] = { root: uId };
    obj["typeCode"] = [this.createTypeCode("G-A186", "SRT", "ShortAxis")];
    this.aim.imageAnnotations.ImageAnnotation.calculationEntityCollection[
      "CalculationEntity"
    ].push(obj);
    return uId;
  };

  createMeanCalcEntity = (mean, preLabel) => {
    let { unit, value } = mean;
    var obj = {};
    obj["calculationResultCollection"] = {
      CalculationResult: this.createCalcResult(unit, "Mean", value, preLabel)
    };
    obj["description"] = { value: "Mean" };
    const uId = generateUid();
    obj["uniqueIdentifier"] = { root: uId };
    obj["typeCode"] = [
      this.createTypeCode(),
      this.createTypeCode("R-00317", "SRT", "Mean")
    ];
    this.imageAnnotations.ImageAnnotation.calculationEntityCollection.CalculationEntity.push(
      obj
    );
    return uId;
  };

  createStdDevCalcEntity = (stdDev, preLabel) => {
    let { unit, value } = stdDev;
    var obj = {};
    obj["calculationResultCollection"] = {
      CalculationResult: this.createCalcResult(
        unit,
        "Standard Deviation",
        value,
        preLabel
      )
    };
    obj["description"] = { value: "Standard Deviation" };
    const uId = generateUid();
    obj["uniqueIdentifier"] = { root: uId };
    obj["typeCode"] = [
      this.createTypeCode(),
      this.createTypeCode("R-10047", "SRT", "Standard Deviation")
    ];
    this.imageAnnotations.ImageAnnotation.calculationEntityCollection[
      "CalculationEntity"
    ].push(obj);
    return uId;
  };

  createMinCalcEntity = (min, preLabel) => {
    let { unit, value } = min;
    var obj = {};
    obj["calculationResultCollection"] = {
      CalculationResult: this.createCalcResult(unit, "Minimum", value, preLabel)
    };
    obj["description"] = { value: "Minimum" };
    const uId = generateUid();
    obj["uniqueIdentifier"] = { root: uId };
    obj["typeCode"] = [
      this.createTypeCode(),
      this.createTypeCode("R-404FB", "SRT", "Minimum")
    ];
    this.imageAnnotations.ImageAnnotation.calculationEntityCollection[
      "CalculationEntity"
    ].push(obj);
    return uId;
  };

  createMaxCalcEntity = (max, preLabel) => {
    let { unit, value } = max;
    var obj = {};
    obj["calculationResultCollection"] = {
      CalculationResult: this.createCalcResult(unit, "Maximum", value, preLabel)
    };
    obj["description"] = { value: "Maximum" };
    const uId = generateUid();
    obj["uniqueIdentifier"] = { root: uId };
    obj["typeCode"] = [
      this.createTypeCode(),
      this.createTypeCode("G-A437", "SRT", "Maximum")
    ];
    this.imageAnnotations.ImageAnnotation.calculationEntityCollection[
      "CalculationEntity"
    ].push(obj);
    return uId;
  };

  createCommonCalcEntites = (mean, stdDev, min, max, preLabel) => {
    var entities = [];
    entities.push(this.createMeanCalcEntity(mean, preLabel));
    entities.push(this.createStdDevCalcEntity(stdDev, preLabel));
    entities.push(this.createMinCalcEntity(min, preLabel));
    entities.push(this.createMaxCalcEntity(max, preLabel));
    return entities;
  };

  createLineCalcEntities = (length, mean, stdDev, min, max) => {
    var entities = [];
    entities.push(this.createLengthCalcEntity(length));
    return entities.concat(
      this.createCommonCalcEntites(mean, stdDev, min, max)
    );
  };

  createLongAxisCalcEntities = (longAxis, mean, stdDev, min, max) => {
    var entities = [];
    entities.push(this.createLongAxisCalcEntity(longAxis));
    return entities.concat(
      this.createCommonCalcEntites(mean, stdDev, min, max, "LongAxis_")
    );
  };

  createShortAxisCalcEntities = (shortAxis, mean, stdDev, min, max) => {
    var entities = [];
    entities.push(this.createShortAxisCalcEntity(shortAxis));
    return entities.concat(
      this.createCommonCalcEntites(mean, stdDev, min, max, "ShortAxis_")
    );
  };

  createCalculationEntityCollection = entities => {
    var obj = {};
    obj["calculationEntityCollection"] = { CalculationEntity: entities };
    return obj;
  };

  /*                                          */
  /*  Markup Entitiy Realted Functions        */
  /*                                          */

  createCoordinate = (coordinate, index) => {
    var obj = {};
    obj["x"] = { value: coordinate.x };
    obj["coordinateIndex"] = { value: index };
    obj["y"] = { value: coordinate.y };
    return obj;
  };

  createCoordinateArray = points => {
    var coordinates = [];
    points.forEach((point, index) => {
      coordinates.push(this.createCoordinate(point, index));
    });
    return coordinates;
  };

  addMarkupEntity = (
    type,
    shapeIndex,
    points,
    imageReferenceUid,
    frameNumber = 1
  ) => {
    //frameNumber should only be sent in multiframes
    var obj = {};
    obj["includeFlag"] = { value: true };
    obj["shapeIdentifier"] = { value: shapeIndex };
    obj["referencedFrameNumber"] = { value: frameNumber };
    obj["xsi:type"] = type;
    obj["twoDimensionSpatialCoordinateCollection"] = {
      TwoDimensionSpatialCoordinate: this.createCoordinateArray(points)
    };
    const uId = generateUid();
    obj["uniqueIdentifier"] = { root: uId };
    obj["imageReferenceUid"] = { root: imageReferenceUid };
    this.imageAnnotations.ImageAnnotation.markupEntityCollection.MarkupEntity.push(
      obj
    );
    return uId;
  };

  _createModality = () => {
    const sopClassUid = this.image.data.string("x00080016") || "";
    if (sopClassUid)
      var {
        codeValue,
        codingSchemeDesignator,
        codeMeaning,
        codingSchemeVersion
      } = modalities[sopClassUid];
    else {
      const modality = this.image.data.string("x00080060") || "";
      if (modality) {
        // look from modalities
        // var {codeValue, codingSchemeDesignator, codeMeaning, codingSchemeVersion} =;
      }
    }
    var obj = {};
    obj["code"] = codeValue;
    obj["codeSystemName"] = codingSchemeDesignator;
    obj["iso:displayName"] = {
      "xmlns:iso:": "uri:iso.org:21090",
      value: codeMeaning
    };
    obj["codeSystemVersion"] = codingSchemeVersion;
    return obj;
  };

  _createImageCollection = () => {
    var obj = {};
    const sopClassUid = this.image.data.string("x00080016") || "";
    const sopInstanceUid = this.image.data.string("x00080018") || "";
    var sopClass = { root: sopClassUid };
    var sopInstance = { root: sopInstanceUid };
    obj["Image"] = { sopClassUid: sopClass, sopInstanceUid: sopInstance };
    return obj;
  };

  _createImageSeries = () => {
    var obj = {};
    obj["modality"] = this._createModality();
    obj["imageColletion"] = this._createImageCollection();
    obj["instanceUid"] = this.image.data.string("x0020000E") || "";
    return obj;
  };

  _createImageStudy = () => {
    var obj = {};
    obj["imageSeries"] = this._createImageSeries();
    obj["startTime"] = { value: this.image.data.string("x00080030") || "" };
    obj["instanceUid"] = { root: this.image.data.string("x0020000D") || "" };
    obj["startDate"] = { value: this.image.data.string("x00080020") || "" };
    obj["accessionNumber"] = {
      value: this.image.data.string("x00080050") || ""
    };
    return obj;
  };

  _createImageReferenceEntity = () => {
    var obj = {};
    obj["imageStudy"] = this._createImageStudy();
    obj["xsi:type"] = "DicomImageReferenceEntity";
    obj["uniqueIdentifier"] = { root: generateUid() };
    return obj;
  };

  _createImageReferanceEntityCollection = () => {
    var obj = {};
    obj["imageReferenceEntityCollection"] = this._createImageReferenceEntity();
    return obj;
  };

  /*                                                */
  /*    Segmentation Entitiy Realted Functions      */
  /*                                                */

  createSegmentationEntity = (
    refrencedSopUid,
    segmentNumber,
    seriesUid,
    studyUid,
    sopClassUid,
    sopInstanceUid,
    uniqueId
  ) => {
    var obj = {};
    obj["referencedSopInstanceUid"] = { root: refrencedSopUid };
    obj["segmentNumber"] = { value: segmentNumber };
    obj["seriesInstanceUid"] = { root: seriesUid };
    obj["studyInstanceUid"] = { root: studyUid };
    obj["xsi:type"] = "DicomSegmentationEntity";
    obj["sopClassUid"] = { root: sopClassUid };
    obj["sopInstanceUid"] = { root: sopInstanceUid };
    obj["uniqueIdentifier"] = { root: uniqueId };
    return obj;
  };

  creatSegmentationEntityCollection = segEntities => {
    var obj = {};
    obj["SegmentationEntity"] = segEntities;
    return obj;
  };

  //
  //
  //
  _createImageAnnotations = (aimType, hasSegmentations) => {
    var obj = {};
    obj["dateTime"] = { value: this.getDate() };
    obj[
      "imageReferenceEntityCollection"
    ] = this._createImageReferanceEntityCollection();
    obj["name"] = {};
    obj["comment"] = {};
    obj["uniqueIdentifier"] = {};
    obj["typeCode"] = {};
    if (aimType === 1) {
      obj["calculationEntityCollection"] = { CalculationEntity: [] };
      obj["markupEntityCollection"] = { MarkupEntity: [] };
      obj["imageAnnotationStatementCollection"] = {
        ImageAnnotationStatement: []
      };
    }
    if (hasSegmentations) obj["segmentationEntityCollection"] = {};
    return { ImageAnnotation: obj };
  };

  createImageAnnotationStatement = (referenceType, objectId, subjectId) => {
    var obj = {};
    var references;
    if (
      referenceType === 1
        ? (references = "CalculationEntityReferencesMarkupEntityStatement")
        : (references =
            "CalculationEntityReferencesSegmentationEntityStatement")
    )
      obj["xsi:type"] = referenceType;
    obj["objectUniqueIdentifier"] = { root: objectId };
    obj["subjectUniqueIdentifier"] = { root: subjectId };
    this.imageAnnotations.ImageAnnotation.imageAnnotationStatementCollection.ImageAnnotationStatement.push(
      obj
    );
  };

  createImageAnnotationStatementCollection = (
    imageAnnotationStatements = []
  ) => {
    var obj = {};
    obj["ImageAnnotationStatement"] = imageAnnotationStatements;
    return obj;
  };

  //
  //
  // Image Annotations
  createImageAnnotation = (annotationStatementCollection = {}) => {
    var obj = {};
    obj["dateTime"] = { value: this.getDate() };
    obj[
      "imageAnnotationStatementCollection"
    ] = this.createImageAnnotationStatementCollection();
    return obj;
  };

  createImageAnnotations = imageAnnotation => {
    var obj = {};
    obj["imageAnnotations"] = imageAnnotation;
    return obj;
  };

  //
  //
  // Person
  createPerson = (sex, name, id, birthDate) => {
    var obj = {};
    obj["sex"] = { value: sex };
    obj["name"] = { name: name };
    obj["id"] = { value: id };
    obj["birthDate"] = { value: birthDate };
    return obj;
  };

  //
  //
  // User
  createUser = (loginName, name) => {
    var obj = {};
    obj["loginName"] = { value: loginName };
    obj["name"] = { value: name };
    return obj;
  };

  save = () => {
    console.log(this);
  };

  //
  //
  // aim
  // createAim(
  //   dateTime,
  //   seriesUid,
  //   studyUid,
  //   imageAnnotations,
  //   accessionNumber,
  //   person,
  //   user
  // ) {
  //   var obj = {};
  //   obj["aimVersion"] = aimConf["aimVersion"];
  //   obj["dateTime"] = { value: dateTime };
  //   obj["seriesInstanceUid"] = { root: seriesUid };
  //   obj["studyInstanceUid"] = { root: studyUid };
  //   obj["imageAnnotations"] = imageAnnotations;
  //   obj["xsi:schemaLocation"] = aimConf["xsi:schemaLocation"];
  //   obj["xmlns:xsi"] = aimConf["xmlns:xsi"];
  //   obj["xmlns:rdf"] = aimConf["xmlns:rdf"];
  //   obj["accessionNumber"] = { value: accessionNumber };
  //   obj["xmlns"] = aimConf["xmlns"];
  //   obj["person"] = person;
  //   obj["user"] = user;
  //   // obj["uniqueIdentifier"] = { root: uniqueId };
  //   return obj;
  // }
}

export default Aim;